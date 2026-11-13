import { transaction } from '../db.mjs';
import { knowledgeFragments, NO_INFORMATION } from '../knowledge/service.mjs';
import { getPolicy } from './policy.mjs';
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
import {
  declinesFamilyContact,
  guardianComplete,
  guardianFrom,
  guardianParts,
  guardianRelation,
  isQuestion,
  unavailableOption,
  words,
} from './intents.mjs';
import { recordProposalResponse } from '../proposals/service.mjs';
import { answerFromKnowledge } from './knowledge.mjs';
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
  getCourseSelection,
  completeCourseSelection,
  listRelatives,
} from './repository.mjs';
import {
  channelList,
  isUnsubscribeQuestion,
  noContactChannels,
  UNSUBSCRIBE_HELP,
} from './consent-prompt.mjs';
import { saveConsent } from '../consents/service.mjs';
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
    / (reembolso|reembolsen|reembolsar|devolucion|devuelvan|devuelvanme|devuelvenme|devolver mi dinero|regresen mi dinero) /.test(
      value,
    ) ||
    / (devolver|devuelven|devuelvan|regresen|regresan|regresar|reintegren|reintegrar) ([a-z]+ ){0,3}(dinero|plata|pago|pague|pagamos|cobro) /.test(
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
// «No le escriban a mi mamá»: si ese familiar está registrado para el mismo beneficiario, se revocan
// sus autorizaciones (los canales nombrados o todos); si no, solo se confirma que no se le invitará.
async function stopRelativeContact(db, participation, text) {
  const relation = guardianRelation(text);
  const roles = !relation
    ? [2, 3, 4]
    : / padres /.test(words(text))
      ? [2, 3]
      : ['familiar', 'responsable'].includes(relation.key)
        ? [2, 3, 4]
        : [relation.role];
  const relatives = await listRelatives(db, {
    beneficiary: participation.idBeneficiario,
    contact: participation.idContacto,
    roles,
  });
  if (!relatives.length) return 'De acuerdo, no enviaré una invitación a esa persona.';
  const channels = noContactChannels(text);
  for (const relative of relatives)
    for (const channel of channels)
      await saveConsent(relative.participationId, {
        channel,
        granted: false,
        version: 'chat-familiar-v1',
      });
  const person = relation ? `tu ${relation.label}` : 'esa persona';
  return channels.length === 3
    ? `De acuerdo, ya no le escribiremos a ${person}.`
    : `De acuerdo, ya no le escribiremos a ${person} por ${channelList(channels)}.`;
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
      if (fields.courses) {
        const selection = await getCourseSelection(db, participationId);
        if (selection && !selection.completed) {
          fields.courses = [...selection.selected, fields.courses];
          await completeCourseSelection(db, selection);
        }
      }
      await saveProfile(participationId, { fields, channel }, { messageId });
    }
    if (reason) {
      await handOff(db, participationId, reason, messageId);
      return;
    }
    if (handoff && !handoff.fechaRetomaAgente) return;
    if (isUnsubscribeQuestion(text)) {
      await createReply(db, participation, UNSUBSCRIBE_HELP, messageId);
      return;
    }
    if (declinesFamilyContact(text)) {
      await createReply(
        db,
        participation,
        await stopRelativeContact(db, participation, text),
        messageId,
      );
      return;
    }
    const policy = await getPolicy(db);
    if (
      ((!policy.proposalLinks && (analysis.action === 'proposal' || analysis.accepts)) ||
        (!policy.trialLinks && analysis.action === 'trial') ||
        (!policy.guardianInvitations && (analysis.needsGuardian || analysis.guardian))) &&
      participation.idEstadoCaso === 1
    ) {
      await handOff(db, participationId, 7, messageId);
      return;
    }
    // Responsable económico (F4): los datos pueden llegar en varios mensajes. Mientras la necesidad
    // no tenga invitación, se unen las partes recibidas desde que se declaró y se pide solo lo que falta.
    const need =
      participation.idEstadoCaso === 1 ? await pendingGuardianNeed(db, participation.idCaso) : null;
    if (need && !policy.guardianInvitations) {
      await handOff(db, participationId, 7, messageId);
      return;
    }
    let guardian = analysis.guardian;
    let partial = null;
    let relative = null;
    let correctedRelative = false;
    if (
      !guardian &&
      participation.idEstadoCaso === 1 &&
      (analysis.needsGuardian || (need && analysis.action === 'ask' && !isQuestion(text)))
    ) {
      const texts = need ? await incomingSince(db, participationId, need.messageId) : [];
      if (!texts.includes(text)) texts.push(text);
      const previousRelative = texts.slice(0, -1).map(guardianRelation).filter(Boolean).at(-1);
      const currentRelative = guardianRelation(text);
      relative = currentRelative || previousRelative;
      correctedRelative = !!(
        currentRelative &&
        previousRelative &&
        currentRelative.key !== previousRelative.key
      );
      const parts = guardianFrom(texts, { nameExpected: !!need });
      const current = guardianParts(text, { nameExpected: !!need });
      if (guardianComplete(parts)) guardian = { ...parts, quote: text.slice(0, 500) };
      else if (analysis.needsGuardian || current.name || current.phone) partial = parts;
    }
    if (guardian && participation.idEstadoCaso === 1 && policy.guardianInvitations) {
      const invitation = await inviteGuardian(participationId, { ...guardian, messageId });
      const url = `${process.env.PUBLIC_ORIGIN || `http://127.0.0.1:${process.env.PORT || 3067}`}/invitacion/${invitation.code}`;
      const first = guardian.name.split(' ')[0];
      const relation = { 2: 'papá', 3: 'mamá', 4: 'responsable' }[guardian.role] ?? 'responsable';
      const target = await findDirectTarget(db, guardian.phone, participation.idContacto);
      const proposer = aud.student
        ? `${contact.name} indicó que eres su ${relation}`
        : `${contact.name} indicó que eres ${{ papá: 'el papá', mamá: 'la mamá' }[relation] ?? 'responsable'} de ${contact.beneficiary}`;
      const invitationText =
        `Hola ${first}, ${proposer}. Te invita a conversar sobre la preparación para la UNT y las opciones de pago. ` +
        `Si estás de acuerdo, revisa y acepta la invitación aquí: ${url}
` +
        'Si no reconoces esta solicitud, puedes ignorar este mensaje.';
      const preparation = aud.student
        ? 'mi preparación'
        : `la preparación de ${contact.beneficiary}`;
      const share = `https://wa.me/${guardian.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
        `Hola ${first}, te comparto la invitación de LaPreDigital para acompañar ${preparation} para la UNT: ${url}`,
      )}`;
      const shareText =
        `Preparé la invitación para ${guardian.name}.\n` +
        `Envíasela por WhatsApp con un toque (el mensaje ya va escrito): ${share}\n` +
        `O reenvíale este enlace: ${url}\n` +
        'Desde allí podrá aceptar la vinculación y autorizar el contacto.';
      const direct = await deliverDirectInvitation(db, {
        target,
        text: invitationText,
        replyTo: messageId,
        fallback: { code: invitation.code, participationId, replyTo: messageId, shareText },
        email: {
          subject: `${contact.name} te invita a acompañar su preparación en LaPreDigital`,
          text: invitationText,
          html: `<p>Hola ${first},</p><p>${proposer}. Te invita a conversar sobre la preparación para la UNT y las opciones de pago.</p><p><a href="${url}">Revisar y aceptar la invitación</a></p><p>Si no reconoces esta solicitud, puedes ignorar este correo.</p>`,
        },
      });
      if (direct.channel) {
        await createReply(
          db,
          participation,
          (direct.queued
            ? `Preparé el envío de la invitación directamente por ${CHANNEL_NAMES[direct.channel]}; está pendiente de confirmación del canal.`
            : `El canal confirmó el envío de la invitación directamente por ${CHANNEL_NAMES[direct.channel]}.`) +
            ` Cuando la acepte, se unirá al caso. También puedes compartirla tú:\n${shareText}`,
          messageId,
        );
        return;
      }
      await createReply(db, participation, `${direct.reason}\n${shareText}`, messageId);
      return;
    }
    if (partial && policy.guardianInvitations) {
      if (!need) await addNeed(db, participation.idCaso, participationId, messageId);
      const own = aud.student ? 'tu' : 'su';
      const spouse = words(text).match(/ (esposa|esposo|pareja|conyuge) /)?.[1];
      const who =
        partial.name ||
        (relative
          ? `${own} ${relative.label}`
          : spouse
            ? `${own} ${spouse}`
            : ({ 2: `${own} papá`, 3: `${own} mamá`, 4: 'esa persona' }[partial.role] ??
              'esa persona'));
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
        correctedRelative
          ? `Entendido, continuamos con ${who}. Cuéntame ${list} para preparar su invitación.`
          : analysis.needsGuardian && !partial.name && !partial.phone
            ? `¡Claro! Podemos incluir a ${who} en ${preparation}. Cuéntame ${list}. Comprobaré si tiene un canal autorizado para escribirle; si no, te daré el enlace de invitación para que se lo envíes tú.`
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
    if (
      policy.useLeadData &&
      policy.recommendAfterProfile &&
      participation.idEstadoCaso === 1 &&
      ['ask', 'catalog'].includes(analysis.action) &&
      known.career &&
      known.availability &&
      known.budget != null &&
      /recomiend|recomendacion|(?:que|cual) plan.*(?:conviene|mejor)|mejor plan/.test(words(text))
    ) {
      await queueNextStep(db, participation, messageId, { recommendationOnly: true });
      return;
    }
    // Una consulta documental no debe iniciar otra pregunta de perfil ni registrarse como tal.
    if (
      analysis.action === 'ask' &&
      !analysis.social &&
      !analysis.fields.length &&
      !need &&
      !analysis.needsGuardian
    ) {
      const answer = answerFromKnowledge(text, workspace.tariffs, await knowledgeFragments());
      if (answer?.sources.some((source) => source.id.startsWith('documento:'))) {
        await createReply(db, participation, answer.text, messageId);
        return;
      }
      if (isQuestion(text)) {
        await createReply(db, participation, NO_INFORMATION, messageId);
        return;
      }
    }
    const profileKey = policy.profileQuestions
      ? policy.questionOrder.find((key) => known[key] == null || String(known[key]).trim() === '')
      : null;
    const nextQuestion = profileKey
      ? profileKey === 'career'
        ? questionText(profileKey, aud).replace('?', ' en la UNT?')
        : questionText(profileKey, aud)
      : '¿Qué te gustaría consultar?';
    // Con las tres preguntas básicas respondidas, el agente hace una sola vez las opcionales (cursos
    // difíciles y postulaciones) y, al terminar, recomienda el plan.
    if (
      analysis.action === 'ask' &&
      !analysis.social &&
      policy.profileQuestions &&
      participation.idEstadoCaso === 1 &&
      known.career &&
      known.availability &&
      known.budget != null
    ) {
      const pending = nextKey(await getProfile(db, participationId), policy);
      const answered = analysis.fields.length > 0;
      if ((pending && !isCoreKey(pending)) || (!pending && answered)) {
        await queueNextStep(db, participation, messageId, { intro: answered ? '¡Anotado! ' : '' });
        return;
      }
    }
    let response = analysis.social
      ? `¡Qué amable! 😊 Sigo aquí para ayudarte a elegir ${aud.student ? 'tu plan' : `el plan de ${aud.name}`}. ${nextQuestion}`
      : profileKey === 'career'
        ? `¡Gracias por escribirme! Para ayudarte mejor, cuéntame: ${nextQuestion.replace('¿Q', '¿q')}`
        : `¡Gracias por escribirme! ${nextQuestion}`;
    if (analysis.action === 'proposal' && !analysis.tariffId) {
      const invalid = unavailableOption(text, workspace.tariffs);
      response = invalid
        ? 'Esa combinación no está disponible para preparar una propuesta. ¿Qué plan y modalidad prefieres?'
        : '¿Qué plan y modalidad quieres contratar?';
    }
    if (analysis.action === 'catalog') {
      const answer = answerFromKnowledge(text, [], await knowledgeFragments());
      response = answer?.text ?? NO_INFORMATION;
      // Una objeción de tiempo permite preguntar por la disponibilidad si está habilitado.
      if (analysis.objection === 3 && policy.profileQuestions)
        response = aud.student
          ? 'Entiendo, el tiempo importa. Cuéntame cuánto tiempo podrías dedicar a estudiar y te recomiendo el plan que mejor encaje contigo.'
          : `Entiendo, el tiempo importa. Cuéntame cuánto tiempo podría dedicar ${aud.name} a estudiar y les recomiendo el plan que mejor le encaje.`;
    }
    if (analysis.action === 'trial') {
      try {
        const trial = await offerTrial(participationId);
        response = `Preparé tu enlace para solicitar la prueba: ${process.env.PUBLIC_ORIGIN || `http://127.0.0.1:${process.env.PORT || 3001}`}/prueba/${trial.token}`;
      } catch (error) {
        if (!(error instanceof BusinessError)) throw error;
        response = error.message;
      }
    }
    const reply = await createReply(db, participation, response, messageId);
    if (analysis.action === 'ask') {
      const field = profileKey ? { career: 2, availability: 6, budget: 7 }[profileKey] : null;
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
