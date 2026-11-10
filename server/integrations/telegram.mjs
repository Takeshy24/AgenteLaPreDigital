import { analyzeMessage } from '../agent/ollama.mjs';
import { actOnAnalysis, handoffReason } from '../agent/service.mjs';
import { saveConsent } from '../consents/service.mjs';
import { pool, transaction } from '../db.mjs';
import { openHandoff } from '../handoffs/service.mjs';
import { assignUnassigned, recordIncoming, recordUnassigned } from '../messages/service.mjs';
import { getWorkspace } from '../workspace/repository.mjs';
import { integrationConfig } from './config.mjs';
import * as repository from './repository.mjs';
import { hashCode } from './service.mjs';

async function analyze(text, participantId) {
  if (!integrationConfig().ollama.enabled) return { analysis: null, error: null };
  try {
    const workspace = await getWorkspace();
    const participant = workspace.leads.find((item) => item.id === participantId);
    return {
      analysis: await analyzeMessage(text, workspace.tariffs, {
        context: {
          contact: participant?.name,
          beneficiary: participant?.beneficiary,
          role: participant?.role,
        },
      }),
      error: null,
    };
  } catch (error) {
    return { analysis: null, error: error.message };
  }
}
async function handleCallback(item, callback, client) {
  const chat = await repository.getChat(await pool(), item.chatId);
  const id = Number(callback.data?.replace('case:', ''));
  const owned =
    chat &&
    (await repository.listContactParticipations(await pool(), chat.idContacto)).some(
      (participant) => participant.id === id,
    );
  if (owned) {
    await transaction(async (db) => {
      await repository.saveSelection(db, chat.idContacto, id);
      await assignUnassigned(chat.idContacto, id);
      await repository.finishUpdate(db, item.updateId);
    });
    await client.call('answerCallbackQuery', {
      callback_query_id: callback.id,
      text: 'Contexto seleccionado. Puedes continuar tu consulta.',
    });
  } else
    await transaction((db) =>
      repository.finishUpdate(db, item.updateId, null, 'Selección inválida'),
    );
}
async function handleStart(item, text, client) {
  const code = text.slice(7).trim();
  const contact = await transaction(async (db) => {
    const contact = await repository.useLink(db, hashCode(code), item.chatId);
    if (contact) await recordUnassigned(contact, 'Inició la conversación con el bot.');
    await repository.finishUpdate(db, item.updateId);
    return contact;
  });
  await client.call('sendMessage', {
    chat_id: item.chatId,
    text: contact
      ? 'Contacto vinculado. Puedes escribir tu consulta. Usa /autorizar para permitir seguimiento por Telegram o /revocar para retirarlo.'
      : 'El enlace no es válido, expiró o ya fue utilizado. Solicita uno nuevo a tu asesor.',
  });
}
async function handleConsent(item, chat, text, participants, client) {
  const grant = text.trim() === '/autorizar';
  const channels = text.trim() === '/revocar' || grant ? [3] : [1, 2, 3];
  if (!participants.length) {
    await transaction((db) =>
      repository.finishUpdate(db, item.updateId, null, 'Sin negociación asociada'),
    );
    return;
  }
  await transaction(async (db) => {
    const message = await recordUnassigned(chat.idContacto, text);
    for (const channel of channels)
      await saveConsent(participants[0].id, { channel, granted: grant, version: 'telegram-v1' });
    await repository.finishUpdate(db, item.updateId, message.id);
  });
  await client.call('sendMessage', {
    chat_id: item.chatId,
    text: grant
      ? 'Autorización registrada para seguimiento por Telegram.'
      : 'Autorización de seguimiento revocada.',
  });
}
function selectParticipation(participants, selection) {
  const open = participants.filter((item) => item.idEstadoCaso === 1);
  const candidates = open.length ? open : participants;
  return {
    candidates,
    target:
      candidates.find((item) => item.id === selection) ||
      (candidates.length === 1 ? candidates[0] : null),
  };
}
async function askBeneficiary(item, chat, text, candidates, client) {
  await transaction(async (db) => {
    const message = await recordUnassigned(chat.idContacto, text);
    await repository.finishUpdate(
      db,
      item.updateId,
      message.id,
      'Beneficiario pendiente de identificar',
    );
  });
  await client.call('sendMessage', {
    chat_id: item.chatId,
    text: '¿Sobre qué beneficiario deseas conversar?',
    reply_markup: {
      inline_keyboard: candidates
        .slice(0, 10)
        .map((item) => [
          { text: `${item.beneficiary} · caso ${item.idCaso}`, callback_data: `case:${item.id}` },
        ]),
    },
  });
}
async function processMessage(item, target, text) {
  const result = await analyze(text, target.id);
  const saved = await transaction(async (db) => {
    const existing = await repository.getUpdate(db, item.updateId);
    if (existing?.processedAt) return null;
    const message = await recordIncoming(
      target.id,
      {
        text,
        channel: 3,
        level: result.analysis?.level ?? 1,
        retraction: result.analysis?.retraction ?? false,
      },
      { source: result.analysis ? 1 : 2 },
    );
    if (result.analysis)
      await repository.saveAnalysis(
        db,
        message.id,
        integrationConfig().ollama.model,
        result.analysis,
      );
    await repository.finishUpdate(db, item.updateId, message.id, result.error);
    return message;
  });
  if (!saved) return;
  if (result.analysis) await actOnAnalysis(saved.participationId, saved.id, text, result.analysis);
  else {
    const reason = handoffReason(text);
    if (reason) await openHandoff(saved.participationId, { reason, messageId: saved.id });
  }
}
export async function processUpdate(item, client) {
  const update = JSON.parse(item.payload);
  if (update.callback_query) return handleCallback(item, update.callback_query, client);
  const message = update.message;
  if (
    !message ||
    message.chat.type !== 'private' ||
    message.from?.is_bot ||
    typeof message.text !== 'string'
  ) {
    await transaction((db) => repository.finishUpdate(db, item.updateId));
    return;
  }
  if (message.text.startsWith('/start ')) return handleStart(item, message.text, client);
  const chat = await repository.getChat(await pool(), item.chatId);
  if (!chat) {
    await transaction((db) => repository.finishUpdate(db, item.updateId));
    await client.call('sendMessage', {
      chat_id: item.chatId,
      text: 'Para proteger tus datos, solicita un enlace de vinculación a tu asesor de LaPreDigital.',
    });
    return;
  }
  const participants = await repository.listContactParticipations(await pool(), chat.idContacto);
  const consentCommand =
    ['/autorizar', '/revocar'].includes(message.text.trim()) ||
    /no me (escrib|contact)|no quiero recibir|dejen de escrib|deja de escrib/i.test(message.text);
  if (consentCommand) return handleConsent(item, chat, message.text, participants, client);
  const selection = await repository.getSelection(await pool(), chat.idContacto);
  const { candidates, target } = selectParticipation(participants, selection);
  if (!target) return askBeneficiary(item, chat, message.text, candidates, client);
  return processMessage(item, target, message.text);
}
export async function pollTelegram(client) {
  const updates = await client.call('getUpdates', {
    offset: await repository.getCursor(await pool()),
    timeout: 10,
    allowed_updates: ['message', 'callback_query'],
  });
  for (const update of updates) await transaction((db) => repository.acceptUpdate(db, update));
  for (const item of await repository.pendingUpdates(await pool())) {
    try {
      await processUpdate(item, client);
    } catch (error) {
      console.error('No se pudo procesar una actualización Telegram:', error.message);
      break;
    }
  }
}
