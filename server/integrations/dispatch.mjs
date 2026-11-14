import { replyMarkup } from '../agent/profile-flow.mjs';
import { pool, transaction } from '../db.mjs';
import { getOpenHandoff } from '../handoffs/repository.mjs';
import { integrationConfig } from './config.mjs';
import * as repository from './repository.mjs';
import { telegramClient } from './telegram-client.mjs';
import { whatsappPayload } from './whatsapp-payload.mjs';
import { getPayload } from '../access/repository.mjs';
import { openMessage } from '../access/crypto.mjs';
import { getWhatsAppRecipient } from './whatsapp-repository.mjs';
import { welcomeApproved } from './welcome-approval.mjs';
import { publicChatLinks } from '../public/channel-links.mjs';
import { hasChannelRecord } from '../consents/repository.mjs';
import {
  INVITATION_IMPEDIMENTS,
  invitationDeliveryImpediment,
  notifyInvitationFailure,
} from '../links/direct.mjs';
// Solo los mensajes con opciones (o que quitan las opciones) llevan marcado en Telegram.
function telegramMarkup(stored) {
  if (!stored) return null;
  const markup = JSON.parse(stored);
  if (markup.inline && markup.inline_keyboard) return { inline_keyboard: markup.inline_keyboard };
  return markup.inline_keyboard || markup.remove_keyboard ? replyMarkup(markup) : null;
}
// El correo no recibe respuestas en el sistema: invita a seguir por WhatsApp o Telegram, donde
// también se puede pedir que no le escriban.
export function followupEmailContent(text) {
  const { whatsappUrl, telegramUrl } = publicChatLinks();
  const links = [
    ...(whatsappUrl ? [`WhatsApp: ${whatsappUrl}`] : []),
    ...(telegramUrl ? [`Telegram: ${telegramUrl}`] : []),
  ];
  return {
    subject: 'LaPreDigital · Seguimiento de tu preparación',
    text: [
      text,
      '',
      ...(links.length ? ['Para responder, escríbenos por:', ...links, ''] : []),
      'Si no deseas recibir más mensajes, escríbenos «no me escriban» por cualquiera de esos canales.',
      '',
      'El equipo de LaPreDigital',
    ].join('\n'),
  };
}
export async function dispatchMessage(
  id,
  client,
  { whatsapp = null, mail = null, welcomeReady } = {},
) {
  const channel = await repository.channelOf(await pool(), id);
  if (channel === 1 && !whatsapp) return { sent: false };
  const credentials = await getPayload(await pool(), id);
  // Por correo solo salen las credenciales y los intentos de la agenda de seguimiento.
  const followupEmail =
    channel === 2 && !credentials && (await repository.isFollowupAttempt(await pool(), id));
  if (channel === 2 && (!mail || (!credentials && !followupEmail))) return { sent: false };
  const approvedWelcome =
    channel === 1 && (await repository.isLandingWelcomeMessage(await pool(), id))
      ? (welcomeReady ?? (await welcomeApproved(integrationConfig().whatsapp)))
      : false;
  const message = await transaction(async (db) => {
    const row = await repository.claimMessage(db, id);
    if (!row) return null;
    if (channel === 1)
      row.whatsappUserId = await getWhatsAppRecipient(
        db,
        integrationConfig().whatsapp.phoneNumberId,
        row.idContacto,
      );
    let reason = await invitationDeliveryImpediment(db, row);
    const handoff = await getOpenHandoff(db, row.idContacto);
    const destination = { 1: row.whatsappUserId || row.telefono, 2: row.correo, 3: row.chatId }[
      channel
    ];
    if (!reason && !destination)
      reason =
        {
          1: 'El contacto no tiene teléfono.',
          2: 'El contacto no tiene correo.',
          3: 'El contacto no vinculó Telegram.',
        }[channel] || 'Canal de entrega no compatible.';
    else if (!reason && credentials && !(await repository.hasConsent(db, row.idContacto, channel)))
      reason = 'El canal de entrega de las credenciales ya no tiene autorización vigente.';
    else if (
      !reason &&
      handoff &&
      !handoff.fechaRetomaAgente &&
      row.idOrigenMensaje !== 3 &&
      !(row.markup && JSON.parse(row.markup).handoff_notice)
    )
      reason = 'Conversación derivada al personal.';
    else if (
      !reason &&
      row.idOrigenMensaje === 1 &&
      (row.idEstadoCaso !== 1 ||
        row.idEstadoParticipacion !== 1 ||
        row.idPrioridadActual === 5 ||
        !(await repository.hasConsent(db, row.idContacto, channel)) ||
        (await repository.hasBlock(db, row.idBeneficiario)))
    )
      reason = 'El seguimiento proactivo no está permitido.';
    if (reason) {
      await repository.markFailed(db, id, reason);
      await notifyInvitationFailure(db, id, reason);
      return null;
    }
    // El permiso pudo registrarse después de preparar la pregunta. Se vuelve a comprobar al
    // despachar y se sustituye solo el aviso pendiente, sin volver a ofrecer autorización.
    if (
      [1, 3].includes(channel) &&
      row.markup &&
      JSON.parse(row.markup).consent_prompt &&
      (await hasChannelRecord(db, row.idContacto, channel))
    ) {
      const name = channel === 1 ? 'WhatsApp' : 'Telegram';
      row.textoMensaje = (await repository.hasConsent(db, row.idContacto, channel))
        ? `Tu autorización de ${name} ya está registrada. Sigamos con tu preparación.`
        : `Se mantiene tu decisión de no recibir seguimiento por ${name}. Solo responderé cuando me escribas.`;
      row.markup = await repository.replaceConsentPrompt(db, id, row.textoMensaje);
    }
    const welcome = row.markup ? JSON.parse(row.markup).welcome : null;
    if (
      channel === 1 &&
      welcome?.source === 'landing' &&
      !approvedWelcome &&
      !(await repository.insideServiceWindow(db, row.idContacto))
    ) {
      await repository.releasePendingMessage(
        db,
        id,
        'Bienvenida pendiente: la plantilla de WhatsApp aún no tiene aprobación verificada.',
      );
      return null;
    }
    return row;
  });
  if (!message) return { sent: false };
  if (credentials) {
    try {
      message.textoMensaje = openMessage(credentials.mensajeCifrado, credentials.idContratacion);
      message.credentials = true;
    } catch {
      await transaction((db) =>
        repository.markFailed(db, id, 'No se pudo recuperar el mensaje cifrado de acceso.'),
      );
      return { sent: false };
    }
  }
  if (channel === 1) return sendWhatsApp(id, message, whatsapp);
  let externalId;
  try {
    if (channel === 2) {
      const result = await mail.send({
        to: message.correo,
        ...(credentials
          ? { subject: 'LaPreDigital · Tus datos de acceso', text: message.textoMensaje }
          : followupEmailContent(message.textoMensaje)),
      });
      if (!result.messageId) throw new Error('Correo sin confirmación de envío.');
      externalId = result.messageId;
    } else {
      const result = await client.call('sendMessage', {
        chat_id: message.chatId,
        text: message.textoMensaje,
        ...(telegramMarkup(message.markup) ? { reply_markup: telegramMarkup(message.markup) } : {}),
      });
      if (!Number.isInteger(result.message_id))
        throw new Error('Telegram no confirmó un identificador de mensaje.');
      externalId = result.message_id;
    }
  } catch (error) {
    const uncertain = error.uncertain ?? !['EAUTH', 'EENVELOPE', 'EMESSAGE'].includes(error.code);
    await transaction(async (db) => {
      await repository.markFailed(
        db,
        id,
        credentials
          ? 'No se pudo confirmar la entrega de las credenciales. Revisa el canal antes de reintentar.'
          : error.message,
        uncertain,
      );
      await notifyInvitationFailure(
        db,
        id,
        INVITATION_IMPEDIMENTS[uncertain ? 'uncertain' : 'delivery'],
      );
    });
    return { sent: false, uncertain };
  }
  try {
    await transaction((db) => repository.markSent(db, id, externalId));
  } catch (error) {
    console.error(
      'El canal aceptó el mensaje pero no se pudo registrar el recibo; no reintentar automáticamente.',
    );
    throw error;
  }
  return { sent: true, externalId };
}
async function sendWhatsApp(id, message, whatsapp) {
  let accepted;
  try {
    const payload = await whatsappPayload(message, integrationConfig().whatsapp);
    accepted = { externalId: await whatsapp.send(payload), template: payload.type === 'template' };
  } catch (error) {
    const uncertain = error.uncertain ?? true;
    await transaction(async (db) => {
      await repository.markFailed(
        db,
        id,
        message.credentials
          ? 'No se pudo confirmar la entrega de las credenciales por WhatsApp.'
          : error.message,
        uncertain,
      );
      await notifyInvitationFailure(
        db,
        id,
        INVITATION_IMPEDIMENTS[uncertain ? 'uncertain' : 'delivery'],
      );
    });
    return { sent: false, uncertain };
  }
  await transaction((db) =>
    repository.markAccepted(db, id, accepted.externalId, accepted.template),
  );
  return { sent: true, externalId: accepted.externalId };
}
export async function dispatchPending(client, { whatsapp = null, mail = null } = {}) {
  const config = integrationConfig();
  if (!client) {
    if (!config.telegram.enabled || !config.telegram.token) client = null;
    else client = telegramClient(config.telegram.token);
  }
  if (!client && !whatsapp && !mail) return { sent: 0 };
  let sent = 0;
  const channels = [...(client ? [3] : []), ...(whatsapp ? [1] : []), ...(mail ? [2] : [])];
  const welcomeReady =
    whatsapp && (await repository.hasPendingWelcome(await pool()))
      ? await welcomeApproved(config.whatsapp)
      : false;
  for (const message of await repository.pendingMessages(await pool(), channels, { welcomeReady }))
    if ((await dispatchMessage(message.id, client, { whatsapp, mail, welcomeReady })).sent) sent++;
  return { sent };
}
