import { replyMarkup } from '../agent/profile-flow.mjs';
import { pool, transaction } from '../db.mjs';
import { getOpenHandoff } from '../handoffs/repository.mjs';
import { integrationConfig } from './config.mjs';
import * as repository from './repository.mjs';
import { telegramClient } from './telegram-client.mjs';
import { whatsappPayload } from './whatsapp-payload.mjs';
import { getPayload } from '../access/repository.mjs';
import { openMessage } from '../access/crypto.mjs';
// Solo los mensajes con opciones (o que quitan las opciones) llevan marcado en Telegram.
function telegramMarkup(stored) {
  if (!stored) return null;
  const markup = JSON.parse(stored);
  if (markup.inline && markup.inline_keyboard) return { inline_keyboard: markup.inline_keyboard };
  return markup.inline_keyboard || markup.remove_keyboard ? replyMarkup(markup) : null;
}
export async function dispatchMessage(id, client, { whatsapp = null, mail = null } = {}) {
  const channel = await repository.channelOf(await pool(), id);
  if (channel === 1 && !whatsapp) return { sent: false };
  const credentials = await getPayload(await pool(), id);
  if (channel === 2 && (!mail || !credentials)) return { sent: false };
  const message = await transaction(async (db) => {
    const row = await repository.claimMessage(db, id);
    if (!row) return null;
    let reason = '';
    const handoff = await getOpenHandoff(db, row.idContacto);
    const destination = { 1: row.telefono, 2: row.correo, 3: row.chatId }[channel];
    if (!destination)
      reason =
        {
          1: 'El contacto no tiene teléfono.',
          2: 'El contacto no tiene correo.',
          3: 'El contacto no vinculó Telegram.',
        }[channel] || 'Canal de entrega no compatible.';
    else if (credentials && !(await repository.hasConsent(db, row.idContacto, channel)))
      reason = 'El canal de entrega de las credenciales ya no tiene autorización vigente.';
    else if (
      handoff &&
      !handoff.fechaRetomaAgente &&
      row.idOrigenMensaje !== 3 &&
      !(row.markup && JSON.parse(row.markup).handoff_notice)
    )
      reason = 'Conversación derivada al personal.';
    else if (
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
        subject: 'LaPreDigital · Tus datos de acceso',
        text: message.textoMensaje,
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
    await transaction((db) =>
      repository.markFailed(
        db,
        id,
        credentials
          ? 'No se pudo confirmar la entrega de las credenciales. Revisa el canal antes de reintentar.'
          : error.message,
        uncertain,
      ),
    );
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
    await transaction((db) =>
      repository.markFailed(
        db,
        id,
        message.credentials
          ? 'No se pudo confirmar la entrega de las credenciales por WhatsApp.'
          : error.message,
        error.uncertain ?? true,
      ),
    );
    return { sent: false, uncertain: error.uncertain ?? true };
  }
  await transaction((db) =>
    repository.markAccepted(db, id, accepted.externalId, accepted.template),
  );
  return { sent: true, externalId: accepted.externalId };
}
export async function dispatchPending(client, { whatsapp = null, mail = null } = {}) {
  const config = integrationConfig().telegram;
  if (!client) {
    if (!config.enabled || !config.token) client = null;
    else client = telegramClient(config.token);
  }
  if (!client && !whatsapp && !mail) return { sent: 0 };
  let sent = 0;
  const channels = [...(client ? [3] : []), ...(whatsapp ? [1] : []), ...(mail ? [2] : [])];
  for (const message of await repository.pendingMessages(await pool(), channels))
    if ((await dispatchMessage(message.id, client, { whatsapp, mail })).sent) sent++;
  return { sent };
}
