import { transaction } from '../db.mjs';
import { getOpenHandoff } from '../handoffs/repository.mjs';
import { openHandoff } from '../handoffs/service.mjs';
import { channelOf, createReply } from '../integrations/repository.mjs';
import { saveProfile } from '../profiles/service.mjs';
import { prepareProposal } from '../proposals/service.mjs';
import { getParticipation } from '../shared/repository.mjs';
import { getWorkspace } from '../workspace/repository.mjs';
import { createOfferLink } from '../public/service.mjs';
import { offerTrial } from '../trials/service.mjs';
import { BusinessError } from '../shared/errors.mjs';
import { getNeed, addNeed } from '../links/repository.mjs';
import { inviteGuardian } from '../links/service.mjs';
import { CHANNEL_NAMES, deliverDirectInvitation, findDirectTarget } from '../links/direct.mjs';
import { describePlans } from './catalog.mjs';
import {
  guardianComplete,
  guardianFrom,
  guardianParts,
  unavailableOption,
  words,
} from './intents.mjs';
import { recordProposalResponse } from '../proposals/service.mjs';
import { answerFromKnowledge, mentionedPlans } from './knowledge.mjs';
import { PAYMENT_QUESTION } from './ollama.mjs';
import {
  findPendingProposal,
  latestOpenProposal,
  getProfile,
  pendingGuardianNeed,
  incomingSince,
  saveObjection,
  appendOfferLink,
  recordQuestion,
  attachMarkup,
} from './repository.mjs';
import {
  audience,
  isCoreKey,
  keyboard,
  KEY_BY_FIELD,
  nextKey,
  questionText,
} from './profile-flow.mjs';
import { queueNextStep } from './profile-service.mjs';
export const HANDOFF_NOTICE =
  'Voy a pasar tu consulta a un asesor del equipo para que te ayude mejor. Te escribirán pronto. 😊';

// Abre la derivación y, solo si es nueva, avisa a la persona una vez. El aviso lleva una marca para
// que el despacho lo envíe aunque la derivación ya esté abierta.
export async function handOff(db, participationId, reason, messageId) {
  const participation = await getParticipation(db, participationId);
  const result = await openHandoff(participationId, { reason, messageId });
  if (result.created) {
    const reply = await createReply(db, participation, HANDOFF_NOTICE, messageId);
    await attachMarkup(db, reply, { handoff_notice: true });
  }
  return result;
}
// Motivos de derivación (sección 2.2) por palabras completas del mensaje.
export function handoffReason(text) {
  const value = words(text);
  if (
    / (reembolso|reembolsen|reembolsar|devolucion|devuelvan|devuelvanme|devolver mi dinero|regresen mi dinero) /.test(
      value,
    )
  )
    return 3;
  if (/ (disputa|contracargo|desconozco el cargo) /.test(value)) return 4;
  // Solo un pedido expreso de descuento o beca se deriva; la pregunta «¿hay becas?» la responde el
  // agente con la base de conocimiento.
  if (
    / (descuento|descuentos|descuentito|beca|becas|rebaja|rebajita|promocion) /.test(value) &&
    / (quiero|quisiera|necesito|solicito|solicitar|pido|pedir|aplicar|aplicame|aplica|ponme|hazme|postular|acceder|dame|denme|hagan|hacer|hacerme|hacen|haces|dan|darian|dar|me (puede|pueden|podria|podrian)) /.test(
      value,
    )
  )
    return 6;
  if (
    / (hablar|comunicarme|comuniquenme|contactar|atender|atienda|atiendan|pasame|pasenme|pasar|pasen|comunicar|derivenme|deriven) ([a-z ]* )?(persona|asesor|asesora|humano|alguien|operador|asesores) /.test(
      value,
    ) ||
    / (asesor humano|persona real) /.test(value)
  )
    return 1;
  if (/ (reclamo|reclamar|queja|quejarme|estafa|denuncia|libro de reclamaciones) /.test(value))
    return 2;
  if (
    / (ya pague|pague y|pague pero|hice el pago|realice el pago|deposite|transferi|ya pagamos) /.test(
      value,
    ) ||
    (/ (pago|pague|pagamos) /.test(value) &&
      / no (me |nos )?(confirman|confirmaron|llega|llego|activan|activaron|aparece|reflejan) /.test(
        value,
      ))
  )
    return 5;
  return null;
}
export async function actOnAnalysis(participationId, messageId, text, analysis) {
  const workspace = await getWorkspace();
  const contact = workspace.leads.find((lead) => lead.id === participationId);
  if (!contact) return;
  const reason = handoffReason(text) || (analysis.action === 'handoff' ? 7 : null);
  return transaction(async (db) => {
    const participation = await getParticipation(db, participationId);
    // A quién se habla: el estudiante (trato directo) o su madre, padre o apoderado.
    const aud = audience(participation.idRolContacto, contact.beneficiary);
    const handoff = await getOpenHandoff(db, participation.idContacto);
    const channel = (await channelOf(db, messageId)) ?? 3;
    if (participation.idEstadoCaso === 1 && analysis.fields.length) {
      const fields = Object.fromEntries(
        analysis.fields.map((item) => [
          item.field,
          ['budget', 'score'].includes(item.field) ? Number(item.value) : item.value,
        ]),
      );
      await saveProfile(participationId, { fields, channel }, { messageId });
    }
    if (reason) {
      await handOff(db, participationId, reason, messageId);
      return;
    }
    if (handoff && !handoff.fechaRetomaAgente) return;
    // Responsable económico (F4): los datos pueden llegar en varios mensajes. Mientras la necesidad
    // no tenga invitación, se unen las partes recibidas desde que se declaró y se pide solo lo que falta.
    const need =
      participation.idEstadoCaso === 1 ? await pendingGuardianNeed(db, participation.idCaso) : null;
    let guardian = analysis.guardian;
    let partial = null;
    if (!guardian && participation.idEstadoCaso === 1 && (need || analysis.needsGuardian)) {
      const texts = need ? await incomingSince(db, participationId, need.messageId) : [];
      if (!texts.includes(text)) texts.push(text);
      const parts = guardianFrom(texts);
      const current = guardianParts(text);
      if (guardianComplete(parts)) guardian = { ...parts, quote: text.slice(0, 500) };
      else if (analysis.needsGuardian || current.name || current.phone) partial = parts;
    }
    if (guardian && participation.idEstadoCaso === 1) {
      const invitation = await inviteGuardian(participationId, { ...guardian, messageId });
      const url = `${process.env.PUBLIC_ORIGIN || `http://127.0.0.1:${process.env.PORT || 3001}`}/invitacion/${invitation.code}`;
      const first = guardian.name.split(' ')[0];
      const relation = { 2: 'papá', 3: 'mamá', 4: 'responsable' }[guardian.role] ?? 'responsable';
      const target = await findDirectTarget(db, guardian.phone, participation.idContacto);
      const proposer = aud.student
        ? `${contact.name} indicó que eres su ${relation}`
        : `${contact.name} indicó que eres ${{ papá: 'el papá', mamá: 'la mamá' }[relation] ?? 'responsable'} de ${contact.beneficiary}`;
      const invitationText =
        `Hola ${first}, ${proposer} y que acompañas su preparación para la UNT. ` +
        `Si estás de acuerdo, revisa y acepta la invitación aquí: ${url}
` +
        'Si no reconoces esta solicitud, puedes ignorar este mensaje.';
      const direct = target
        ? await deliverDirectInvitation(db, {
            target,
            text: invitationText,
            replyTo: messageId,
            email: {
              subject: `${contact.name} te invita a acompañar su preparación en LaPreDigital`,
              text: invitationText,
              html: `<p>Hola ${first},</p><p>${proposer} y que acompañas su preparación para la UNT.</p><p><a href="${url}">Revisar y aceptar la invitación</a></p><p>Si no reconoces esta solicitud, puedes ignorar este correo.</p>`,
            },
          })
        : null;
      if (direct) {
        await createReply(
          db,
          participation,
          `¡Listo! ${guardian.name} ya tiene una cuenta con nosotros, así que le envié la invitación directamente por ${CHANNEL_NAMES[direct.channel]}. Cuando la acepte, se unirá a tu caso.`,
          messageId,
        );
        return;
      }
      const share = `https://wa.me/${guardian.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
        `Hola ${first}, te comparto la invitación de LaPreDigital para acompañar mi preparación para la UNT: ${url}`,
      )}`;
      await createReply(
        db,
        participation,
        `¡Listo! Preparé la invitación para ${guardian.name}.
` +
          `Envíasela por WhatsApp con un toque (el mensaje ya va escrito): ${share}
` +
          `O reenvíale este enlace: ${url}
` +
          'Desde allí podrá aceptar la vinculación y autorizar el contacto. No le escribiremos antes de que acepte.',
        messageId,
      );
      return;
    }
    if (partial) {
      if (!need) await addNeed(db, participation.idCaso, participationId, messageId);
      const own = aud.student ? 'tu' : 'su';
      const who =
        { 2: `${own} papá`, 3: `${own} mamá`, 4: 'esa persona' }[partial.role] ?? 'esa persona';
      const preparation = aud.student ? 'tu preparación' : `la preparación de ${aud.name}`;
      const missing = [
        !partial.name && 'su nombre completo',
        !partial.phone && 'su número de celular',
        !partial.role &&
          (aud.student
            ? 'qué es tuyo (papá, mamá u otro familiar)'
            : `qué es de ${aud.name} (papá, mamá u otro familiar)`),
      ].filter(Boolean);
      const list =
        missing.length > 1 ? `${missing.slice(0, -1).join(', ')} y ${missing.at(-1)}` : missing[0];
      await createReply(
        db,
        participation,
        analysis.needsGuardian && !partial.name && !partial.phone
          ? `¡Claro! Podemos incluir a ${who} en ${preparation}. Para enviarle una invitación, cuéntame ${list}. No le escribiremos hasta que acepte.`
          : `¡Gracias! Para preparar la invitación de ${who} solo me falta ${list}.`,
        messageId,
      );
      return;
    }
    if (participation.idEstadoCaso === 1 && analysis.action === 'proposal' && analysis.tariffId) {
      const previous = await findPendingProposal(
        db,
        participation.idCaso,
        participationId,
        analysis.tariffId,
      );
      const proposal =
        previous ||
        (await prepareProposal(
          participationId,
          {
            tariff: analysis.tariffId,
            replyTo: messageId,
            channel,
            justification: `Preparación según el contexto declarado por ${contact.name}. Carrera: ${contact.career || 'pendiente de confirmar'}.`,
          },
          { agent: true },
        ));
      const link = await createOfferLink(
        proposal.id,
        process.env.PUBLIC_ORIGIN || `http://127.0.0.1:${process.env.PORT || 3001}`,
        { prepared: true },
      );
      if (previous)
        await createReply(
          db,
          participation,
          `Tu propuesta de esta alternativa sigue disponible. Revisa el periodo y el precio antes de aceptar: ${link.url}`,
          messageId,
        );
      else await appendOfferLink(db, proposal.messageId, link.url);
      return proposal;
    }
    if (analysis.objection && participation.idEstadoCaso === 1)
      await saveObjection(db, {
        id: participationId,
        type: analysis.objection,
        text,
        messageId,
      });
    // Rechazo expreso de la propuesta vigente por el chat (F5, tabla 5: baja el nivel a Consulta).
    if (analysis.retraction && participation.idEstadoCaso === 1) {
      const open = await latestOpenProposal(db, participationId);
      if (open) await recordProposalResponse(open.id, { messageId, result: 2 });
      await createReply(
        db,
        participation,
        open
          ? 'Entendido, dejo esa propuesta como no aceptada. Si más adelante quieres revisar otro plan o probar Explora UNT gratis, escríbeme. 😊'
          : 'Entendido, no hay problema. Si más adelante quieres revisar un plan o probar Explora UNT gratis, escríbeme. 😊',
        messageId,
      );
      return;
    }
    // Aceptación por el chat: la aceptación y las condiciones se registran en la oferta personal.
    if (analysis.accepts && participation.idEstadoCaso === 1) {
      const open = await latestOpenProposal(db, participationId);
      if (open) {
        const link = await createOfferLink(
          open.id,
          process.env.PUBLIC_ORIGIN || `http://127.0.0.1:${process.env.PORT || 3001}`,
        );
        await createReply(
          db,
          participation,
          `¡Genial! Para aceptarla, revisa y acepta la propuesta y las condiciones en tu enlace personal; desde allí puedes pagar: ${link.url}
La aceptación no confirma el pago.`,
          messageId,
        );
        return;
      }
    }
    if (analysis.attachment) {
      await createReply(
        db,
        participation,
        'Recibí tu archivo, pero solo puedo leer mensajes de texto. Si es un comprobante: el pago se confirma cuando la pasarela lo registra, no con una captura; si ya pagaste y no se refleja, cuéntamelo por escrito y te paso con un asesor. ¿Me escribes tu consulta?',
        messageId,
      );
      return;
    }
    const known = {
      ...contact,
      ...Object.fromEntries(analysis.fields.map((item) => [item.field, item.value])),
    };
    const careerQuestion = questionText('career', aud).replace('?', ' en la UNT?');
    const nextQuestion = !known.career
      ? careerQuestion
      : !known.availability
        ? questionText('availability', aud)
        : known.budget == null
          ? questionText('budget', aud)
          : '¿Quieres que te cuente qué incluye cada plan o prefieres que te prepare una propuesta?';
    // Con las tres preguntas básicas respondidas, el agente hace una sola vez las opcionales (cursos
    // difíciles y postulaciones) y, al terminar, recomienda el plan.
    if (
      analysis.action === 'ask' &&
      !analysis.social &&
      participation.idEstadoCaso === 1 &&
      known.career &&
      known.availability &&
      known.budget != null
    ) {
      const pending = nextKey(await getProfile(db, participationId));
      const answered = analysis.fields.some((item) =>
        ['courses', 'applications', 'score'].includes(item.field),
      );
      if ((pending && !isCoreKey(pending)) || (!pending && answered)) {
        await queueNextStep(db, participation, messageId, { intro: answered ? '¡Anotado! ' : '' });
        return;
      }
    }
    let response = analysis.social
      ? `¡Qué amable! 😊 Sigo aquí para ayudarte a elegir ${aud.student ? 'tu plan' : `el plan de ${aud.name}`}. ${nextQuestion}`
      : !known.career
        ? `¡Gracias por escribirme! Para ayudarte mejor, cuéntame: ${careerQuestion.replace('¿Q', '¿q')}`
        : !known.availability
          ? aud.student
            ? `¡Qué bien! Para prepararte para ${known.career}, ¿cuánto tiempo puedes dedicar a estudiar?`
            : `¡Qué bien! Para preparar a ${aud.name} para ${known.career}, ¿cuánto tiempo puede dedicar a estudiar?`
          : known.budget == null
            ? `¡Gracias! Una última pregunta: ${questionText('budget', aud).replace('¿C', '¿c')}`
            : '¿Qué plan o modalidad te interesa? Con gusto te aclaro los precios y te ayudo a preparar una propuesta.';
    if (analysis.action === 'proposal' && !analysis.tariffId) {
      const invalid = unavailableOption(text, workspace.tariffs);
      response = invalid
        ? `${invalid} Meta UNT y Meta UNT Plus pueden ser mensuales o semestrales. ¿Cuál prefieres?`
        : '¿Qué plan y modalidad quieres contratar? Ruta UNT tiene modalidad mensual; Meta UNT y Meta UNT Plus, mensual o semestral.';
    }
    if (analysis.action === 'catalog') {
      // Respuesta extractiva desde la base de conocimiento; si no hay fragmentos, el catálogo completo.
      // «¿Qué incluye Meta UNT?» pide la ficha completa del plan (beneficios y precios).
      const planSheet =
        mentionedPlans(text).length &&
        / (incluye|incluyen|trae|ofrece|beneficios|contiene) /.test(words(text));
      const answer = planSheet ? null : answerFromKnowledge(text, workspace.tariffs);
      response = answer?.text ?? describePlans(text, workspace.tariffs);
      const invalid = unavailableOption(text, workspace.tariffs);
      if (invalid) response = `${invalid} ${response}`;
      // Objeciones sin fragmento propio: tiempo se convierte en la pregunta de disponibilidad;
      // confianza y alternativas se atienden con la prueba gratuita.
      if (analysis.objection === 3)
        response = aud.student
          ? 'Entiendo, el tiempo importa. Cuéntame cuánto tiempo podrías dedicar a estudiar y te recomiendo el plan que mejor encaje contigo.'
          : `Entiendo, el tiempo importa. Cuéntame cuánto tiempo podría dedicar ${aud.name} a estudiar y les recomiendo el plan que mejor le encaje.`;
      if ([2, 5].includes(analysis.objection))
        response =
          'Es normal querer comparar antes de decidir. LaPreDigital es una preparación 100 % virtual para la admisión a la UNT, y con Explora UNT puedes probarla gratis 14 días antes de pagar. Si quieres probarla, escríbeme «quiero probar Explora».';
      if (!answer && PAYMENT_QUESTION.test(text))
        response = `El pago se hace de forma segura desde el enlace de tu propuesta, donde verás los medios disponibles. Para generarlo solo dime qué plan quieres. 😊 ${response}`;
    }
    if (analysis.action === 'trial') {
      try {
        const trial = await offerTrial(participationId);
        response = `Explora UNT ofrece 14 días gratuitos, una vez por beneficiario. Puedes solicitar su activación aquí: ${process.env.PUBLIC_ORIGIN || `http://127.0.0.1:${process.env.PORT || 3001}`}/prueba/${trial.token}`;
      } catch (error) {
        if (!(error instanceof BusinessError)) throw error;
        response = error.message;
      }
    }
    const reply = await createReply(db, participation, response, messageId);
    if (analysis.action === 'ask') {
      const field = !known.career ? 2 : !known.availability ? 6 : known.budget == null ? 7 : null;
      if (field) {
        await recordQuestion(db, participation, reply, field);
        await attachMarkup(db, reply, {
          inline_keyboard: keyboard(
            participation.idLeadCaso,
            KEY_BY_FIELD[field],
            workspace.tariffs,
            aud,
          ),
        });
      }
    }
  });
}
