import { replyMarkup } from '../agent/profile-flow.mjs';
import { pool, transaction } from '../db.mjs';
import { getOpenHandoff } from '../handoffs/repository.mjs';
import { integrationConfig } from './config.mjs';
import * as repository from './repository.mjs';
import { telegramClient } from './telegram-client.mjs';
import { whatsappPayload } from './whatsapp-payload.mjs';
// Solo los mensajes con opciones (o que quitan las opciones) llevan marcado en Telegram.
function telegramMarkup(stored) {
  if (!stored) return null;
  const markup = JSON.parse(stored);
  if (markup.inline && markup.inline_keyboard) return { inline_keyboard: markup.inline_keyboard };
  return markup.inline_keyboard || markup.remove_keyboard ? replyMarkup(markup) : null;
}
export async function dispatchMessage(id, client, { whatsapp = null } = {}) {
  const channel = await repository.channelOf(await pool(), id);
  if (channel === 1 && !whatsapp) return { sent: false };
  const message = await transaction(async (db) => {
    const row = await repository.claimMessage(db, id);
    if (!row) return null;
    let reason = '';
    const handoff = await getOpenHandoff(db, row.idContacto);
    if (channel === 1 ? !row.telefono : !row.chatId)
      reason =
        channel === 1 ? 'El contacto no tiene teléfono.' : 'El contacto no vinculó Telegram.';
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
  if (channel === 1) return sendWhatsApp(id, message, whatsapp);
  let result;
  try {
    result = await client.call('sendMessage', {
      chat_id: message.chatId,
      text: message.textoMensaje,
      ...(telegramMarkup(message.markup) ? { reply_markup: telegramMarkup(message.markup) } : {}),
    });
    if (!Number.isInteger(result.message_id))
      throw new Error('Telegram no confirmó un identificador de mensaje.');
  } catch (error) {
    await transaction((db) =>
      repository.markFailed(db, id, error.message, error.uncertain ?? true),
    );
    return { sent: false, uncertain: error.uncertain ?? true };
  }
  try {
    await transaction((db) => repository.markSent(db, id, result.message_id));
  } catch (error) {
    console.error(
      'Telegram aceptó el mensaje pero no se pudo registrar el recibo; no reintentar automáticamente.',
    );
    throw error;
  }
  return { sent: true, externalId: result.message_id };
}
async function sendWhatsApp(id, message, whatsapp) {
  let accepted;
  try {
    const payload = await whatsappPayload(message, integrationConfig().whatsapp);
    accepted = { externalId: await whatsapp.send(payload), template: payload.type === 'template' };
  } catch (error) {
    await transaction((db) =>
      repository.markFailed(db, id, error.message, error.uncertain ?? true),
    );
    return { sent: false, uncertain: error.uncertain ?? true };
  }
  await transaction((db) =>
    repository.markAccepted(db, id, accepted.externalId, accepted.template),
  );
  return { sent: true, externalId: accepted.externalId };
}
export async function dispatchPending(client, { whatsapp = null } = {}) {
  const config = integrationConfig().telegram;
  if (!client) {
    if (!config.enabled || !config.token) client = null;
    else client = telegramClient(config.token);
  }
  if (!client && !whatsapp) return { sent: 0 };
  let sent = 0;
  const channels = [...(client ? [3] : []), ...(whatsapp ? [1] : [])];
  for (const message of await repository.pendingMessages(await pool(), channels))
    if ((await dispatchMessage(message.id, client, { whatsapp })).sent) sent++;
  return { sent };
}
