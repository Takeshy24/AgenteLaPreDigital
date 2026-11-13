import { z } from 'zod';
import { transaction } from '../db.mjs';
import { getOperator, getParticipation } from '../shared/repository.mjs';
import { saveEvidence } from '../cases/repository.mjs';
import { recordUnassigned, assignUnassigned } from '../messages/service.mjs';
import { createLead } from '../leads/service.mjs';
import { findContacts, findBeneficiaryByName, findConsent } from '../leads/repository.mjs';
import { finishUpdate, getUpdate, markSent, markFailed } from '../integrations/repository.mjs';
import { BusinessError } from '../shared/errors.mjs';
import * as repository from './repository.mjs';
import { revokeChannel } from '../consents/repository.mjs';
import { answerFromKnowledge } from '../agent/knowledge.mjs';
import { knowledgeFragments, NO_INFORMATION } from '../knowledge/service.mjs';
import { dispatchMessage } from '../integrations/dispatch.mjs';
import { getWhatsAppEvent, finishWhatsAppEvent } from '../integrations/repository.mjs';
import { queueNextStep } from '../agent/profile-service.mjs';

const questions = {
  name: '¿Cuál es tu nombre completo?',
  email: '¿Cuál es tu correo electrónico?',
  phone: '¿Cuál es tu teléfono con código de país? Ejemplo: +51912345678.',
  role: '¿Cuál es tu rol? Responde 1: estudiante, 2: padre, 3: madre o 4: apoderado.',
  beneficiary: '¿Cuál es el nombre completo del estudiante beneficiario?',
  review:
    'Tu identidad necesita revisión del personal comercial para evitar duplicar o mezclar registros. Tu solicitud quedó guardada.',
};
function question(step, channel = 3) {
  if (step === 'consent')
    return `¿Autorizas el seguimiento comercial por ${channel === 1 ? 'WhatsApp' : 'Telegram'}? Responde AUTORIZO o NO AUTORIZO. Puedes retirarlo con /revocar.`;
  if (step === 'consentDenied')
    return 'No se habilitó seguimiento comercial. Para autorizarlo, escribe AUTORIZO; puedes mantener tu decisión y consultar los planes.';
  return questions[step] || questions.name;
}
export function readAnswer(step, text) {
  const value = text.trim();
  if (step === 'name' || step === 'beneficiary')
    return value.length >= 2 && value.length <= 150 ? value : null;
  if (step === 'email')
    return z.email().max(254).safeParse(value).success ? value.toLowerCase() : null;
  if (step === 'phone') return /^\+[0-9 ]{7,19}$/.test(value) ? value.replace(/\s/g, '') : null;
  if (step === 'role') return /^[1-4]$/.test(value) ? Number(value) : null;
  if (step === 'consent' || step === 'consentDenied')
    return /^(autorizo|\/autorizar)$/i.test(value)
      ? true
      : /^(no autorizo|\/revocar)$/i.test(value)
        ? false
        : null;
  return null;
}
async function sendReply(item, client, work, { channel = 3 } = {}) {
  const done = async (db) =>
    !!(
      channel === 1 ? await getWhatsAppEvent(db, item.eventKey) : await getUpdate(db, item.updateId)
    )?.processedAt;
  const finish = (db, message) =>
    channel === 1
      ? finishWhatsAppEvent(db, item.eventKey, message)
      : finishUpdate(db, item.updateId, message);
  const prepared = await transaction(async (db) => {
    if (await done(db)) return null;
    const result = await work(db);
    const incoming = await recordUnassigned(result.contact, item.text, channel);
    if (result.complete) {
      await assignUnassigned(result.contact, result.participation.idLeadCaso);
      const message = await queueNextStep(db, result.participation, incoming.id, {
        intro: '¡Registro completado! ',
      });
      await finish(db, incoming.id);
      return { message, queued: true };
    }
    const message = await repository.recordReply(
      db,
      result.contact,
      incoming.id,
      result.text,
      channel,
    );
    await finish(db, incoming.id);
    return { message, text: result.text };
  });
  if (!prepared) return;
  if (channel === 1 || prepared.queued) {
    return dispatchMessage(prepared.message, channel === 3 ? client : null, {
      whatsapp: channel === 1 ? client : null,
    });
  }
  let receipt;
  try {
    receipt = await client.call('sendMessage', { chat_id: item.chatId, text: prepared.text });
    if (!Number.isInteger(receipt.message_id)) throw new Error('Telegram no confirmó el mensaje.');
  } catch (error) {
    await transaction((db) =>
      markFailed(db, prepared.message, error.message, error.uncertain ?? true),
    );
    throw error;
  }
  await transaction((db) => markSent(db, prepared.message, receipt.message_id));
}
export async function startOnboarding(item, text, client) {
  return sendReply({ ...item, text }, client, async (db) => {
    const contact = await repository.createChatContact(db, item.chatId);
    const provisional = await repository.createRequest(db, { contact, text });
    await repository.saveState(db, contact, { channel: 3 }, 'name', provisional);
    return {
      contact,
      text: `Hola, soy el asistente de LaPreDigital. Para ayudarte con tu preparación para la UNT necesito completar tu registro. ${questions.name}`,
    };
  });
}
export async function createPhoneOnboarding(db, phone, text) {
  const contact = await repository.createPhoneContact(db, phone);
  const provisional = await repository.createRequest(db, { contact, text });
  await repository.saveState(db, contact, { phone, channel: 1 }, 'new', provisional);
  return contact;
}
async function finishOnboarding(db, state, payload, contact) {
  await repository.saveContact(db, contact, payload);
  const lead = await createLead(
    {
      ...payload,
      channel: 5,
      communicationChannel: payload.channel ?? 3,
      beneficiaryName: payload.beneficiary,
    },
    { contactId: contact },
  );
  if (payload.consent) await repository.markChatConsent(db, contact, payload.channel ?? 3);
  await repository.linkRequest(db, { id: state.idSolicitud, contact, lead: lead.id });
  return {
    contact,
    complete: true,
    participation: await getParticipation(db, lead.id),
  };
}
export async function continueOnboarding(item, contact, text, client, { channel = 3 } = {}) {
  const state = await transaction((db) => repository.getState(db, contact));
  if (!state) return false;
  await sendReply(
    { ...item, text },
    client,
    async (db) => {
      const payload = JSON.parse(state.payload);
      payload.channel = channel;
      if (state.step === 'new') {
        await repository.saveState(db, contact, payload, 'name');
        return {
          contact,
          text: `¡Hola! Soy el asistente de LaPreDigital. Ya guardé tu número para completar tu registro por este chat. ${questions.name}`,
        };
      }
      const revoked =
        /^(\/revocar|no autorizo)$/i.test(text.trim()) ||
        /no me (escrib|contact)|no quiero recibir|dejen de escrib|deja de escrib/i.test(text);
      if (revoked && !['consent', 'consentDenied'].includes(state.step)) {
        for (const revokedChannel of text.trim() === '/revocar' ? [channel] : [1, 2, 3])
          await revokeChannel(db, { contact, channel: revokedChannel });
        payload.consent = false;
        await repository.saveState(db, contact, payload, state.step);
        return {
          contact,
          text: `Retiré la autorización de seguimiento indicada. Puedes continuar tu consulta respondiendo: ${question(state.step, channel)}`,
        };
      }
      if (text.trim() === '/autorizar' && !['consent', 'consentDenied'].includes(state.step))
        return {
          contact,
          text: `Puedes autorizar el seguimiento al terminar el registro. ${question(state.step, channel)}`,
        };
      if (state.step === 'expired') {
        const provisional = await repository.createRequest(db, { contact, text });
        await repository.saveState(
          db,
          contact,
          { phone: payload.phone, channel },
          'name',
          provisional,
        );
        return { contact, text: `Podemos iniciar una nueva solicitud. ${questions.name}` };
      }
      if (state.step === 'review') return { contact, text: questions.review };
      const answer = readAnswer(state.step, text);
      if (
        state.step === 'consentDenied' &&
        answer === null &&
        /plan|precio|cuesta|incluye|ruta|meta|explora/i.test(text)
      )
        return {
          contact,
          text: answerFromKnowledge(text, [], await knowledgeFragments())?.text ?? NO_INFORMATION,
        };
      if (answer === null) return { contact, text: question(state.step, channel) };
      payload[state.step === 'consentDenied' ? 'consent' : state.step] = answer;
      if (state.step === 'email') {
        const matches = await findContacts(db, { email: answer });
        if (matches.recordset.some((row) => row.id !== contact)) {
          await repository.saveState(db, contact, payload, 'review');
          return { contact, text: questions.review };
        }
      }
      await repository.saveKnownContact(db, contact, payload);
      if (payload.role === 1) payload.beneficiary = payload.name;
      let step =
        ['name', 'email', 'phone', 'role', 'beneficiary', 'consent'].find(
          (key) => payload[key] === undefined,
        ) ?? 'complete';
      if (step === 'complete') {
        if (!payload.consent && !(await findConsent(db, { contact })).recordset.length) {
          await repository.saveState(db, contact, payload, 'consentDenied');
          return { contact, text: question('consentDenied', channel) };
        }
        const match = await findContacts(db, payload);
        const candidates = await findBeneficiaryByName(db, payload.beneficiary.toUpperCase());
        if (match.recordset.some((row) => row.id !== contact) || candidates.length) step = 'review';
        else return finishOnboarding(db, state, payload, contact);
      }
      await repository.saveState(db, contact, payload, step);
      return { contact, text: question(step, channel) };
    },
    { channel },
  );
  return true;
}
export async function onboardingQuestion(contact) {
  const state = await transaction((db) => repository.getState(db, contact));
  return state ? question(state.step, JSON.parse(state.payload).channel ?? 3) : null;
}
export async function completeOnboarding(id, data) {
  return transaction(async (db) => {
    const state = await repository.getRequestState(db, id);
    if (!state) throw new BusinessError('Esta captación ya se completó o no existe.', 404);
    const payload = {
      ...data,
      email: data.email.trim().toLowerCase(),
      beneficiaryName: data.beneficiary,
      channel: 5,
      communicationChannel: JSON.parse(state.payload).channel === 1 ? 1 : 3,
    };
    const match = await findContacts(db, payload);
    const contact = match.recordset[0]?.id || state.idContacto;
    if (contact !== state.idContacto) {
      if (
        (await repository.hasChat(db, state.idContacto)) &&
        (await repository.hasChat(db, contact))
      )
        throw new BusinessError(
          'Este contacto ya tiene otro chat vinculado. Continúa desde su cuenta Telegram original.',
        );
      await repository.mergeChat(db, contact, state.idContacto);
    }
    await repository.saveContact(db, contact, payload);
    const lead = await createLead(payload, { contactId: contact });
    await repository.linkRequest(db, { id, contact, lead: lead.id });
    const participant = await getParticipation(db, lead.id);
    await saveEvidence(db, {
      caseId: participant.idCaso,
      operation: 'onboarding-identity-reviewed',
      reference: `Solicitud ${id}; contacto provisional ${state.idContacto}; contacto confirmado ${contact}`,
      operator: await getOperator(db),
    });
    return { participationId: lead.id };
  });
}
