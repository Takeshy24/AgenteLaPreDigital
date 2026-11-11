import { createHmac, timingSafeEqual } from 'node:crypto';
import { greeting, welcomeBack } from '../agent/profile-flow.mjs';
import { getProfile } from '../agent/repository.mjs';
import { queueNextStep } from '../agent/profile-service.mjs';
import { answerConsent, askChannelConsent, parseConsent } from '../agent/consent-prompt.mjs';
import { saveConsent } from '../consents/service.mjs';
import { pool, transaction } from '../db.mjs';
import { assignUnassigned, recordIncoming, recordUnassigned } from '../messages/service.mjs';
import { getParticipation } from '../shared/repository.mjs';
import { integrationConfig } from './config.mjs';
import * as repository from './repository.mjs';
import { answerFromKeyboard, processMessage } from './telegram.mjs';
import { ATTACHMENT } from '../agent/social.mjs';

const GREETING =
  /^(hola|buenas|buen dia|buenos dias|buenas tardes|buenas noches|hi|hello|inicio|empezar|start)/;
const NO_CONTACT = /no me (escrib|contact)|no quiero recibir|dejen de escrib|deja de escrib|stop/i;

export function verifyWhatsAppSignature(rawBody, header, secret) {
  if (!secret || !header?.startsWith('sha256=')) return false;
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  const received = header.slice(7);
  return (
    expected.length === received.length &&
    timingSafeEqual(Buffer.from(expected), Buffer.from(received))
  );
}

export function verifyWebhookChallenge(query, verifyToken) {
  if (!verifyToken) return null;
  if (query['hub.mode'] !== 'subscribe' || query['hub.verify_token'] !== verifyToken) return null;
  return String(query['hub.challenge'] ?? '');
}

// Convierte el cuerpo de un webhook de Meta en eventos simples y únicos (los reintentos se ignoran).
export function extractEvents(body, phoneNumberId) {
  const events = [];
  for (const entry of body?.entry ?? [])
    for (const change of entry.changes ?? []) {
      const value = change.value ?? {};
      if (phoneNumberId && value.metadata?.phone_number_id !== phoneNumberId) continue;
      for (const message of value.messages ?? [])
        events.push({
          key: `m:${message.id}`,
          kind: 'message',
          waId: String(message.from),
          payload: message,
        });
      for (const status of value.statuses ?? [])
        events.push({
          key: `s:${status.id}:${status.status}`,
          kind: 'status',
          waId: String(status.recipient_id ?? ''),
          payload: status,
        });
    }
  return events;
}

export async function receiveWebhook(body) {
  const config = integrationConfig().whatsapp;
  const events = extractEvents(body, config.phoneNumberId);
  await transaction(async (db) => {
    for (const event of events) await repository.acceptWhatsAppEvent(db, event);
  });
  return events.length;
}

async function handleStatus(item) {
  const status = JSON.parse(item.payload);
  const db = await pool();
  const messageId = await repository.findDispatchByExternalId(db, status.id);
  if (!messageId) {
    // El estado puede llegar antes de que se guarde el recibo del envío: se espera un poco.
    const waited = Date.now() - new Date(item.receivedAt + '-05:00').getTime();
    if (waited < 120000) return;
    await transaction((tx) =>
      repository.finishWhatsAppEvent(tx, item.eventKey, null, 'Mensaje desconocido'),
    );
    return;
  }
  await transaction(async (tx) => {
    if (['delivered', 'read'].includes(status.status))
      await repository.markDelivered(tx, messageId);
    if (status.status === 'failed')
      await repository.markRejected(tx, messageId, status.errors?.[0]?.title || 'Entrega fallida');
    await repository.finishWhatsAppEvent(tx, item.eventKey);
  });
}

function readMessage(payload) {
  if (payload.type === 'text') return { text: payload.text?.body ?? '' };
  const reply = payload.interactive?.list_reply ?? payload.interactive?.button_reply;
  if (payload.type === 'interactive' && reply) return { text: reply.title, data: reply.id };
  if (payload.type === 'button' && payload.button?.text) return { text: payload.button.text };
  // Una reacción vacía es el retiro de una reacción anterior: no es un mensaje.
  if (payload.type === 'reaction')
    return payload.reaction?.emoji ? { text: payload.reaction.emoji } : null;
  // Sin texto: la leyenda del archivo, un emoji para el sticker o la marca de adjunto.
  const caption = payload[payload.type]?.caption;
  return { text: caption || (payload.type === 'sticker' ? '😊' : ATTACHMENT) };
}

function emailsIn(text) {
  return (text.match(/[^ @<>,;:]+@[^ @<>,;:]+[.][^ @<>,;:]+/g) ?? []).map((value) =>
    value.toLowerCase(),
  );
}

async function resolveContact(item, text, client) {
  const db = await pool();
  const candidates = await repository.contactsByPhone(db, item.waId);
  if (candidates.length === 1) return candidates[0].id;
  if (candidates.length > 1) {
    // Un teléfono puede repetirse entre contactos: se identifica por el correo escrito en el mensaje.
    const written = emailsIn(text);
    const match = candidates.find((candidate) =>
      written.includes(String(candidate.correo).toLowerCase()),
    );
    if (match) return match.id;
    await client.sendText(
      item.waId,
      'Tu número está asociado a más de un registro. ¿Me escribes el correo con el que te registraste para identificarte? 😊',
    );
    return null;
  }
  const landing =
    process.env.LANDING_URL ||
    (process.env.LANDING_ORIGINS || '').split(',')[0].trim() ||
    (process.env.PUBLIC_ORIGIN ? `${process.env.PUBLIC_ORIGIN}/landing` : '');
  await client.sendText(
    item.waId,
    `¡Hola! 😊 Aún no te tengo registrado. ${landing ? `Regístrate aquí y seguimos por este chat: ${landing}` : 'Regístrate en nuestra página y seguimos por este chat.'}`,
  );
  return null;
}

async function askBeneficiary(item, contact, text, candidates, client) {
  await transaction(async (db) => {
    const message = await recordUnassigned(contact, text, 1);
    await repository.finishWhatsAppEvent(
      db,
      item.eventKey,
      message.id,
      'Beneficiario pendiente de identificar',
    );
  });
  await client.send({
    to: item.waId,
    type: 'interactive',
    interactive: {
      type: 'list',
      body: { text: '¿Sobre qué beneficiario deseas conversar?' },
      action: {
        button: 'Ver opciones',
        sections: [
          {
            title: 'Beneficiarios',
            rows: candidates.slice(0, 10).map((candidate) => ({
              id: `case:${candidate.id}`,
              title: String(candidate.beneficiary).slice(0, 24),
            })),
          },
        ],
      },
    },
  });
}

async function handleNoContact(item, contact, text, participants, client) {
  if (!participants.length) {
    await transaction((db) =>
      repository.finishWhatsAppEvent(db, item.eventKey, null, 'Sin negociación asociada'),
    );
    return;
  }
  await transaction(async (db) => {
    const message = await recordUnassigned(contact, text, 1);
    for (const channel of [1, 2, 3])
      await saveConsent(participants[0].id, { channel, granted: false, version: 'whatsapp-v1' });
    await repository.finishWhatsAppEvent(db, item.eventKey, message.id);
  });
  await client.sendText(
    item.waId,
    'Listo, no te escribiremos más. Si cambias de opinión, solo avísame. 🙌',
  );
}

// Primer mensaje de alguien registrado: saluda por su nombre y empieza el cuestionario con opciones.
async function welcome(item, target, text, context) {
  return transaction(async (db) => {
    if (await context.done(db)) return;
    const incoming = await recordIncoming(target.id, { text, channel: 1, level: 1 }, { source: 2 });
    const participation = await getParticipation(db, target.id);
    const name = await repository.contactName(db, participation.idContacto);
    const profile = await getProfile(db, target.id);
    const known = ['career', 'availability', 'budget'].some(
      (key) => profile[key] != null && String(profile[key]).trim() !== '',
    );
    await queueNextStep(db, participation, incoming.id, {
      intro: known ? welcomeBack(name) : greeting(name),
    });
    await askChannelConsent(db, participation, 1, incoming.id);
    await context.finish(db, incoming.id);
  });
}

async function processWhatsAppMessage(item, client) {
  const payload = JSON.parse(item.payload);
  const read = readMessage(payload);
  const finish = (error) =>
    transaction((db) => repository.finishWhatsAppEvent(db, item.eventKey, null, error));
  if (!read) return finish('Reacción retirada');
  const contact = await resolveContact(item, read.text, client);
  if (!contact) return finish('Contacto sin identificar');
  const db = await pool();
  const participants = await repository.listContactParticipations(db, contact);
  if (NO_CONTACT.test(read.text))
    return handleNoContact(item, contact, read.text, participants, client);
  if (read.data?.startsWith('ok:')) {
    const parsed = parseConsent(read.data);
    if (!parsed || !participants.some((participant) => participant.id === parsed.participationId))
      return finish('Selección inválida');
    const result = await answerConsent(parsed.participationId, {
      granted: parsed.granted,
      channel: 1,
      text: read.text,
    });
    return transaction((tx) =>
      repository.finishWhatsAppEvent(tx, item.eventKey, result.messageId ?? null),
    );
  }
  if (read.data?.startsWith('case:')) {
    const id = Number(read.data.slice(5));
    if (!participants.some((participant) => participant.id === id))
      return finish('Selección inválida');
    await transaction(async (tx) => {
      await repository.saveSelection(tx, contact, id);
      await assignUnassigned(contact, id);
      await repository.finishWhatsAppEvent(tx, item.eventKey);
    });
    return client.sendText(item.waId, 'Contexto seleccionado. Puedes continuar tu consulta. 😊');
  }
  const open = participants.filter((participant) => participant.idEstadoCaso === 1);
  const candidates = open.length ? open : participants;
  const selection = await repository.getSelection(db, contact);
  const target =
    candidates.find((participant) => participant.id === selection) ||
    (candidates.length === 1 ? candidates[0] : null);
  if (!target) return askBeneficiary(item, contact, read.text, candidates, client);
  const context = {
    channel: 1,
    done: async (tx) => !!(await repository.getWhatsAppEvent(tx, item.eventKey))?.processedAt,
    finish: (tx, messageId = null, error = null) =>
      repository.finishWhatsAppEvent(tx, item.eventKey, messageId, error),
  };
  const first = (await repository.countIncoming(db, contact, 1)) === 0;
  if (
    first &&
    open.length === 1 &&
    !read.data &&
    GREETING.test(
      read.text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[^a-z ]/g, '')
        .trim(),
    )
  )
    return welcome(item, target, read.text, context);
  if (await answerFromKeyboard(context, target, read.text, { data: read.data })) return;
  return processMessage(context, target, read.text);
}

export async function pollWhatsApp(client) {
  for (const item of await repository.pendingWhatsAppEvents(await pool())) {
    try {
      if (item.kind === 'status') await handleStatus(item);
      else await processWhatsAppMessage(item, client);
    } catch (error) {
      console.error('No se pudo procesar un evento de WhatsApp:', error.message);
      break;
    }
  }
}
