import { pool, transaction } from '../db.mjs';
import { getOpenHandoff } from '../handoffs/repository.mjs';
import { integrationConfig } from './config.mjs';
import * as repository from './repository.mjs';
import { telegramClient } from './telegram-client.mjs';
export async function dispatchMessage(id, client) {
  const message = await transaction(async (db) => {
    const row = await repository.claimMessage(db, id);
    if (!row) return null;
    let reason = '';
    const handoff = await getOpenHandoff(db, row.idContacto);
    if (!row.chatId) reason = 'El contacto no vinculó Telegram.';
    else if (handoff && !handoff.fechaRetomaAgente && row.idOrigenMensaje !== 3)
      reason = 'Conversación derivada al personal.';
    else if (
      row.idOrigenMensaje === 1 &&
      (row.idEstadoCaso !== 1 ||
        row.idEstadoParticipacion !== 1 ||
        row.idPrioridadActual === 5 ||
        !(await repository.hasConsent(db, row.idContacto, 3)) ||
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
  let result;
  try {
    result = await client.call('sendMessage', {
      chat_id: message.chatId,
      text: message.textoMensaje,
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
export async function dispatchPending(client) {
  const config = integrationConfig().telegram;
  if (!client) {
    if (!config.enabled || !config.token) return { sent: 0 };
    client = telegramClient(config.token);
  }
  let sent = 0;
  for (const message of await repository.pendingMessages(await pool()))
    if ((await dispatchMessage(message.id, client)).sent) sent++;
  return { sent };
}
