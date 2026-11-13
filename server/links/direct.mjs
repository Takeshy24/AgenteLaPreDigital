// Invitación directa al responsable económico que ya es contacto (F4): si el número que dio el
// estudiante pertenece a un único contacto con un canal autorizado y utilizable, el sistema le envía
// la invitación por ese canal. Se usa el primer canal que autorizó, como en la agenda (tabla 7).
import { listChannels } from '../followup/repository.mjs';
import { integrationConfig } from '../integrations/config.mjs';
import { sendEmail, smtpConfigured } from '../integrations/mailer.mjs';
import { createReply, insideServiceWindow } from '../integrations/repository.mjs';
import { getParticipation } from '../shared/repository.mjs';
import { getOpenHandoff } from '../handoffs/repository.mjs';
import * as repository from './direct-repository.mjs';

export const CHANNEL_NAMES = { 1: 'WhatsApp', 2: 'correo', 3: 'Telegram' };
const defaultMailer = () => (smtpConfigured() ? sendEmail : null);
export const INVITATION_IMPEDIMENTS = {
  authorization:
    'No tengo una autorización de contacto verificable de esa persona para escribirle a ese número.',
  channel: 'No puedo enviarle el mensaje porque su canal autorizado no está disponible.',
  window:
    'No puedo enviarle esta invitación por WhatsApp porque no hay una conversación reciente con esa persona habilitada para este envío.',
  delivery: 'El canal no permitió completar el envío de la invitación.',
  uncertain:
    'No pude confirmar si el canal recibió la invitación; no volveré a enviarla automáticamente.',
};

export async function findDirectTarget(db, phone, studentContact) {
  const found = await repository.contactsByPhone(db, phone);
  return found.length === 1 && found[0].id !== studentContact ? found[0] : null;
}

// Canal utilizable ahora: Telegram si inició el bot, WhatsApp solo dentro de las 24 horas (fuera
// de ellas este flujo ofrece el enlace para compartir) y correo si hay SMTP.
async function usable(db, channel, contact, mailer) {
  const config = integrationConfig();
  if (channel.idCanal === 3) return config.telegram.enabled && !!config.telegram.token;
  if (channel.idCanal === 1)
    return (
      config.whatsapp.enabled &&
      !!config.whatsapp.token &&
      !!config.whatsapp.phoneNumberId &&
      (await insideServiceWindow(db, contact))
    );
  return !!mailer && !!channel.correo;
}

export async function deliverDirectInvitation(
  db,
  { target, text, email, replyTo, fallback = null },
  { mailer = defaultMailer() } = {},
) {
  if (!target) return { reason: INVITATION_IMPEDIMENTS.authorization };
  if (fallback) {
    const previous = await repository.previousInvitationDelivery(db, target.id, fallback.code);
    if (previous) {
      if (previous.delivered === 3) return { reason: INVITATION_IMPEDIMENTS.delivery };
      if (previous.state === 'unknown') return { reason: INVITATION_IMPEDIMENTS.uncertain };
      return { channel: previous.channel, queued: previous.delivered !== 2, id: previous.id };
    }
  }
  const channels = await listChannels(db, target.id);
  if (!channels.length) {
    const permission = await repository.hasAuthorization(db, target.id);
    return { reason: INVITATION_IMPEDIMENTS[permission ? 'channel' : 'authorization'] };
  }
  const handoff = await getOpenHandoff(db, target.id);
  if (handoff && !handoff.fechaRetomaAgente) return { reason: INVITATION_IMPEDIMENTS.channel };
  let reason = INVITATION_IMPEDIMENTS.channel;
  for (const channel of channels) {
    if (!(await usable(db, channel, target.id, mailer))) {
      if (channel.idCanal === 1 && !(await insideServiceWindow(db, target.id)))
        reason = INVITATION_IMPEDIMENTS.window;
      continue;
    }
    let receipt;
    if (channel.idCanal === 2) {
      try {
        receipt = await mailer({ to: channel.correo, ...email });
      } catch {
        reason = INVITATION_IMPEDIMENTS.delivery;
        continue;
      }
    }
    const id = await repository.createInvitationMessage(db, {
      contact: target.id,
      channel: channel.idCanal,
      authorization: channel.idAutorizacion,
      replyTo,
      text,
      state: channel.idCanal === 2 ? 2 : 1,
    });
    if (fallback)
      await repository.saveInvitationDispatch(db, id, channel.idCanal, receipt, fallback);
    return { channel: channel.idCanal, queued: channel.idCanal !== 2, id };
  }
  return { reason };
}

export async function invitationDeliveryImpediment(db, message) {
  if (!message.markup || !JSON.parse(message.markup).invitation) return null;
  const allowed = await repository.hasDeliveryAuthorization(db, message);
  if (!allowed) return INVITATION_IMPEDIMENTS.authorization;
  if (message.idCanal === 1 && !(await insideServiceWindow(db, message.idContacto)))
    return INVITATION_IMPEDIMENTS.window;
  return null;
}

export async function notifyInvitationFailure(db, id, reason) {
  const dispatch = await repository.invitationDispatch(db, id);
  const markup = dispatch?.markup ? JSON.parse(dispatch.markup) : null;
  const invitation = markup?.invitation;
  if (!invitation || invitation.notified || dispatch.idEstadoEntrega === 2) return;
  const participation = await getParticipation(db, invitation.participationId);
  if (participation.idEstadoCaso === 1)
    await createReply(db, participation, `${reason}\n${invitation.shareText}`, invitation.replyTo);
  invitation.notified = true;
  await repository.saveDispatchMarkup(db, id, markup);
}

// Contacto al que se envió directamente la invitación de este código, si lo hubo.
export async function directInvitee(db, code) {
  return repository.deliveredInvitee(db, code);
}
