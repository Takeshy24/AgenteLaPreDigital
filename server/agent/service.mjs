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
import { PAYMENT_QUESTION } from './ollama.mjs';
import {
  findPendingProposal,
  appendOfferLink,
  recordQuestion,
  attachMarkup,
} from './repository.mjs';
import { keyboard, KEY_BY_FIELD } from './profile-flow.mjs';
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
export function handoffReason(text) {
  const value = text.toLowerCase();
  if (/reembolso|devoluci[oó]n/.test(value)) return 3;
  if (/disputa|contracargo/.test(value)) return 4;
  if (/descuento|beca/.test(value)) return 6;
  if (/hablar.*(persona|asesor|humano)|atienda.*persona/.test(value)) return 1;
  if (/reclamo|queja/.test(value)) return 2;
  if (/pag[ué]|ya pag|pago no/.test(value)) return 5;
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
          item.field === 'budget' ? Number(item.value) : item.value,
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
      response =
        '¿Qué plan y modalidad quieres contratar? Ruta UNT tiene modalidad mensual; Meta UNT y Meta UNT Plus, mensual o semestral.';
    if (analysis.action === 'catalog') {
      response = describePlans(text, workspace.tariffs);
      if (PAYMENT_QUESTION.test(text))
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
