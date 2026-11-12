import { agentEnabled, analyzeMessage } from '../agent/ollama.mjs';
import { greeting, parseCallback, welcomeBack } from '../agent/profile-flow.mjs';
import { getProfile } from '../agent/repository.mjs';
import {
  answerAction,
  answerProfile,
  matchKeyboardReply,
  queueNextStep,
} from '../agent/profile-service.mjs';
import { actOnAnalysis, handOff, handoffReason } from '../agent/service.mjs';
import {
  ATTACHMENT,
  ATTACHMENT_ANALYSIS,
  isSocialMessage,
  SOCIAL_ANALYSIS,
} from '../agent/social.mjs';
import { answerConsent, askChannelConsent, parseConsent } from '../agent/consent-prompt.mjs';
import { saveConsent } from '../consents/service.mjs';
import { pool, query, transaction } from '../db.mjs';
import { getRecentHistory, updateFailures, getRequestedPlan } from '../agent/repository.mjs';
import { BusinessError } from '../shared/errors.mjs';
import { getParticipation } from '../shared/repository.mjs';
import { getOpenHandoff } from '../handoffs/repository.mjs';
import { assignUnassigned, recordIncoming, recordUnassigned } from '../messages/service.mjs';
import { getWorkspace } from '../workspace/repository.mjs';
import { integrationConfig } from './config.mjs';
import * as repository from './repository.mjs';
import { hashCode } from './service.mjs';
import { startOnboarding, continueOnboarding, onboardingQuestion } from '../onboarding/service.mjs';

async function analyze(text, participantId) {
  if (!agentEnabled()) return { analysis: null, error: null };
  try {
    const workspace = await getWorkspace();
    const participant = workspace.leads.find((item) => item.id === participantId);
    const history = await getRecentHistory(await pool(), participantId);
    return {
      analysis: await analyzeMessage(text, workspace.tariffs, {
        context: {
          contact: participant?.name,
          beneficiary: participant?.beneficiary,
          role: participant?.role,
          career: participant?.career,
          availability: participant?.availability,
          budget: participant?.budget,
          history,
          requestedPlan: participant
            ? await getRequestedPlan(await pool(), participant.idContacto)
            : null,
        },
      }),
      error: null,
    };
  } catch (error) {
    return { analysis: null, error: error.message };
  }
}
function notify(client, method, data) {
  try {
    Promise.resolve(client.call(method, data, { timeout: 5000 })).catch(() => {});
  } catch {
    // Telegram es opcional aquí: un fallo inmediato tampoco debe detener la cola.
  }
}
async function handleProfileCallback(item, callback, client) {
  const chat = await repository.getChat(await pool(), item.chatId);
  const parsed = parseCallback(callback.data);
  const owned =
    chat &&
    parsed &&
    (await repository.listContactParticipations(await pool(), chat.idContacto)).some(
      (participant) => participant.id === parsed.participationId && participant.idEstadoCaso === 1,
    );
  if (!owned) {
    await transaction((db) =>
      repository.finishUpdate(db, item.updateId, null, 'Selección inválida'),
    );
    return;
  }
  let feedback = '¡Listo!';
  let keepKeyboard = false;
  try {
    await transaction(async (db) => {
      if ((await repository.getUpdate(db, item.updateId))?.processedAt) return;
      const result = ['c', 'a', 'b', 'd', 'e'].includes(parsed.letter)
        ? await answerProfile(parsed.participationId, parsed)
        : await answerAction(parsed.participationId, parsed);
      if (result.alreadyAnswered) feedback = 'Ya la tengo anotada 😊';
      keepKeyboard = !!result.other;
      await repository.finishUpdate(db, item.updateId);
    });
  } catch (error) {
    // Un clic que no se puede aplicar no debe dejar la cola detenida: se cierra con su motivo.
    if (!(error instanceof BusinessError)) throw error;
    feedback = 'Uy, no pude anotar eso. ¿Lo intentamos de nuevo?';
    await transaction((db) => repository.finishUpdate(db, item.updateId, null, error.message));
  }
  // Avisos opcionales: con la red lenta no deben retrasar la cola ni hacer fallar la actualización.
  notify(client, 'answerCallbackQuery', { callback_query_id: callback.id, text: feedback });
  if (callback.message && !keepKeyboard)
    notify(client, 'editMessageReplyMarkup', {
      chat_id: item.chatId,
      message_id: callback.message.message_id,
      reply_markup: { inline_keyboard: [] },
    });
}
async function handleConsentCallback(item, callback, client) {
  const chat = await repository.getChat(await pool(), item.chatId);
  const parsed = parseConsent(callback.data);
  const owned =
    chat &&
    parsed &&
    (await repository.listContactParticipations(await pool(), chat.idContacto)).some(
      (participant) => participant.id === parsed.participationId,
    );
  if (!owned) {
    await transaction((db) =>
      repository.finishUpdate(db, item.updateId, null, 'Selección inválida'),
    );
    return;
  }
  let feedback = parsed.granted ? '¡Gracias!' : 'Entendido';
  try {
    await transaction(async (db) => {
      if ((await repository.getUpdate(db, item.updateId))?.processedAt) return;
      const result = await answerConsent(parsed.participationId, {
        granted: parsed.granted,
        channel: 3,
      });
      if (result.already) feedback = 'Ya lo tengo anotado 😊';
      await repository.finishUpdate(db, item.updateId, result.messageId ?? null);
    });
  } catch (error) {
    if (!(error instanceof BusinessError)) throw error;
    feedback = 'No pude anotar tu respuesta.';
    await transaction((db) => repository.finishUpdate(db, item.updateId, null, error.message));
  }
  notify(client, 'answerCallbackQuery', { callback_query_id: callback.id, text: feedback });
  if (callback.message)
    notify(client, 'editMessageReplyMarkup', {
      chat_id: item.chatId,
      message_id: callback.message.message_id,
      reply_markup: { inline_keyboard: [] },
    });
}
async function handleCallback(item, callback, client) {
  if (callback.data?.startsWith('pf:')) return handleProfileCallback(item, callback, client);
  if (callback.data?.startsWith('ok:')) return handleConsentCallback(item, callback, client);
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
// Tras vincular, el agente saluda por su nombre y empieza a conocer a la persona con preguntas
// cortas con botones. Si el enlace nació de un formulario donde se pidió Telegram, abrirlo y pulsar
// Iniciar ya es la autorización de ese canal: no se vuelve a pedir.
async function welcome(db, contact, replyTo, withConsent) {
  const onboarding = await onboardingQuestion(contact);
  if (onboarding) return { text: onboarding };
  const open = (await repository.listContactParticipations(db, contact)).filter(
    (participant) => participant.idEstadoCaso === 1,
  );
  if (open.length !== 1)
    return {
      text: '¡Listo, ya estás conectado! Cuéntame, ¿sobre qué estudiante quieres conversar?',
    };
  if (withConsent)
    await saveConsent(open[0].id, { channel: 3, granted: true, version: 'landing-telegram-v1' });
  const name = (
    await query(db, 'SELECT nombreCompleto name FROM dbo.Contacto WHERE idContacto = @contact', {
      contact,
    })
  ).recordset[0]?.name;
  const profile = await getProfile(db, open[0].id);
  const known = ['career', 'availability', 'budget'].some(
    (key) => profile[key] != null && String(profile[key]).trim() !== '',
  );
  const participation = await getParticipation(db, open[0].id);
  await queueNextStep(db, participation, replyTo, {
    intro: known ? welcomeBack(name) : greeting(name),
  });
  await askChannelConsent(db, participation, 3, replyTo);
  return { queued: true };
}
async function handleStart(item, text, client) {
  const code = text.slice(7).trim();
  const result = await transaction(async (db) => {
    const hash = hashCode(code);
    const contact = await repository.useLink(db, hash, item.chatId);
    let reply = null;
    if (contact) {
      const incoming = await recordUnassigned(contact, text);
      reply = await welcome(db, contact, incoming.id, await repository.linkHadConsent(db, hash));
    }
    await repository.finishUpdate(db, item.updateId);
    return { contact, reply };
  });
  if (result.reply?.queued) return;
  await client.call('sendMessage', {
    chat_id: item.chatId,
    text: result.contact
      ? result.reply.text
      : '¡Ups! Ese enlace ya no es válido: puede que haya vencido o que ya se haya usado. Pide uno nuevo desde nuestra página y con gusto seguimos 😊',
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
// Una respuesta con el teclado de botones es un mensaje real de la persona: se registra una sola
// vez y se aplica igual que un clic. Si no corresponde a un botón vigente, sigue el flujo normal.
const telegramContext = (item) => ({
  channel: 3,
  done: async (db) => !!(await repository.getUpdate(db, item.updateId))?.processedAt,
  finish: (db, messageId = null, error = null) =>
    repository.finishUpdate(db, item.updateId, messageId, error),
});
export async function answerFromKeyboard(context, target, text, { data = null } = {}) {
  try {
    return await transaction(async (db) => {
      if (await context.done(db)) return true;
      const parsed = await matchKeyboardReply(db, target.id, text, { data });
      if (!parsed) return false;
      const options = { text, channel: context.channel };
      const result = ['c', 'a', 'b', 'd', 'e'].includes(parsed.letter)
        ? await answerProfile(target.id, parsed, options)
        : await answerAction(target.id, parsed, options);
      const participant = await getParticipation(db, target.id);
      await updateFailures(db, participant.idContacto, false);
      await context.finish(db, result.messageId ?? null);
      return true;
    });
  } catch (error) {
    if (error instanceof BusinessError) return false;
    throw error;
  }
}
export async function processMessage(context, target, text) {
  if (await answerFromKeyboard(context, target, text)) return;
  const attachment = text === ATTACHMENT;
  const social = attachment || isSocialMessage(text);
  const result = attachment
    ? { analysis: ATTACHMENT_ANALYSIS, error: null }
    : social
      ? { analysis: SOCIAL_ANALYSIS, error: null }
      : await analyze(text, target.id);
  if (result.analysis?.understood === false) {
    result.error = 'Mensaje no interpretable';
    result.analysis = null;
  }
  return transaction(async (db) => {
    if (await context.done(db)) return;
    const message = await recordIncoming(
      target.id,
      {
        text,
        channel: context.channel,
        level: result.analysis?.level ?? 1,
        retraction: result.analysis?.retraction ?? false,
      },
      { source: result.analysis && !social ? 1 : 2 },
    );
    if (result.analysis && !social)
      await repository.saveAnalysis(
        db,
        message.id,
        result.analysis.model ?? integrationConfig().ollama.model,
        result.analysis,
      );
    const participant = await getParticipation(db, message.participationId);
    const failures = await updateFailures(db, participant.idContacto, !!result.error);
    if (result.analysis) {
      await actOnAnalysis(message.participationId, message.id, text, result.analysis);
    } else {
      const reason = handoffReason(text);
      const handoff = await getOpenHandoff(db, participant.idContacto);
      if (reason || (result.error && failures >= 2))
        await handOff(db, message.participationId, reason || 7, message.id);
      else if (result.error && (!handoff || handoff.fechaRetomaAgente))
        await repository.createReply(
          db,
          participant,
          'No pude interpretar tu consulta. ¿Puedes reformularla indicando el plan o la duda que tienes?',
          message.id,
        );
    }
    const handoffNow = await getOpenHandoff(db, participant.idContacto);
    if (!result.error && (!handoffNow || handoffNow.fechaRetomaAgente))
      await askChannelConsent(
        db,
        await getParticipation(db, message.participationId),
        context.channel,
        message.id,
      );
    await context.finish(db, message.id, result.error);
  });
}
export async function processUpdate(item, client) {
  if ((await repository.getUpdate(await pool(), item.updateId))?.processedAt) return;
  const update = JSON.parse(item.payload);
  if (update.callback_query) return handleCallback(item, update.callback_query, client);
  const message = update.message;
  if (!message || message.chat.type !== 'private' || message.from?.is_bot) {
    await transaction((db) => repository.finishUpdate(db, item.updateId));
    return;
  }
  // Sin texto: la leyenda de la foto o documento, el emoji del sticker o la marca de adjunto.
  message.text =
    typeof message.text === 'string'
      ? message.text
      : message.caption || message.sticker?.emoji || ATTACHMENT;
  if (message.text.startsWith('/start ')) return handleStart(item, message.text, client);
  const chat = await repository.getChat(await pool(), item.chatId);
  if (!chat) {
    return startOnboarding(item, message.text, client);
  }
  if (await continueOnboarding(item, chat.idContacto, message.text, client)) return;
  const participants = await repository.listContactParticipations(await pool(), chat.idContacto);
  const consentCommand =
    ['/autorizar', '/revocar'].includes(message.text.trim()) ||
    /no me (escrib|contact)|no quiero recibir|dejen de escrib|deja de escrib/i.test(message.text);
  if (consentCommand) return handleConsent(item, chat, message.text, participants, client);
  const selection = await repository.getSelection(await pool(), chat.idContacto);
  const { candidates, target } = selectParticipation(participants, selection);
  if (!target) return askBeneficiary(item, chat, message.text, candidates, client);
  return processMessage(telegramContext(item), target, message.text);
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
