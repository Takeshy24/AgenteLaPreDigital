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
import { describePlans } from './catalog.mjs';
import { unavailableOption, words } from './intents.mjs';
import { recordProposalResponse } from '../proposals/service.mjs';
import { answerFromKnowledge } from './knowledge.mjs';
import { PAYMENT_QUESTION } from './ollama.mjs';
import {
  findPendingProposal,
  latestOpenProposal,
  getProfile,
  saveObjection,
  appendOfferLink,
  recordQuestion,
  attachMarkup,
} from './repository.mjs';
import { isCoreKey, keyboard, KEY_BY_FIELD, nextKey } from './profile-flow.mjs';
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
    if (analysis.guardian && participation.idEstadoCaso === 1) {
      const invitation = await inviteGuardian(participationId, { ...analysis.guardian, messageId });
      const url = `${process.env.PUBLIC_ORIGIN || `http://127.0.0.1:${process.env.PORT || 3001}`}/invitacion/${invitation.code}`;
      await createReply(
        db,
        participation,
        `Reenvía este enlace a ${analysis.guardian.name}: ${url}\nDesde allí podrá aceptar la vinculación al caso y autorizar el contacto. No le escribiré antes de que autorice.`,
        messageId,
      );
      return;
    }
    if (analysis.needsGuardian && participation.idEstadoCaso === 1) {
      if (!(await getNeed(db, participation.idCaso)))
        await addNeed(db, participation.idCaso, participationId, messageId);
      await createReply(
        db,
        participation,
        'Podemos incluir a la persona que decide o paga tu preparación. Indica en un mensaje su nombre completo, teléfono internacional y relación contigo (padre, madre o apoderado). Prepararé un enlace que podrás reenviarle para que autorice la vinculación y el contacto.',
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
    const nextQuestion = !known.career
      ? '¿Qué carrera te gustaría estudiar en la UNT?'
      : !known.availability
        ? '¿Cuánto tiempo puedes dedicar a estudiar?'
        : known.budget == null
          ? '¿Cuánto podrías invertir al mes en tu preparación?'
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
      ? `¡Qué amable! 😊 Sigo aquí para ayudarte a elegir tu plan. ${nextQuestion}`
      : !known.career
        ? '¡Gracias por escribirme! Para ayudarte mejor, cuéntame: ¿qué carrera te gustaría estudiar en la UNT?'
        : !known.availability
          ? `¡Qué bien! Para prepararte para ${known.career}, ¿cuánto tiempo puedes dedicar a estudiar?`
          : known.budget == null
            ? '¡Gracias! Una última pregunta: ¿cuánto podrías invertir al mes en tu preparación?'
            : '¿Qué plan o modalidad te interesa? Con gusto te aclaro los precios y te ayudo a preparar una propuesta.';
    if (analysis.action === 'proposal' && !analysis.tariffId)
      response = `${unavailableOption(text, workspace.tariffs) ?? '¿Qué plan y modalidad quieres contratar?'} Ruta UNT tiene modalidad mensual; Meta UNT y Meta UNT Plus, mensual o semestral.`;
    if (analysis.action === 'catalog') {
      // Respuesta extractiva desde la base de conocimiento; si no hay fragmentos, el catálogo completo.
      const answer = answerFromKnowledge(text, workspace.tariffs);
      response = answer?.text ?? describePlans(text, workspace.tariffs);
      const invalid = unavailableOption(text, workspace.tariffs);
      if (invalid) response = `${invalid} ${response}`;
      // Objeciones sin fragmento propio: tiempo se convierte en la pregunta de disponibilidad;
      // confianza y alternativas se atienden con la prueba gratuita.
      if (analysis.objection === 3)
        response =
          'Entiendo, el tiempo importa. Cuéntame cuánto tiempo podrías dedicar a estudiar y te recomiendo el plan que mejor encaje contigo.';
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
          ),
        });
      }
    }
  });
}
