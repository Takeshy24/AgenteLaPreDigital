import { z } from 'zod';
import { transaction } from '../db.mjs';
import { getOperator, getParticipation } from '../shared/repository.mjs';
import { saveEvidence } from '../cases/repository.mjs';
import { recordUnassigned } from '../messages/service.mjs';
import { createLead } from '../leads/service.mjs';
import { findContacts, findBeneficiaryByName, findConsent } from '../leads/repository.mjs';
import { finishUpdate, getUpdate, markSent, markFailed } from '../integrations/repository.mjs';
import { BusinessError } from '../shared/errors.mjs';
import * as repository from './repository.mjs';
import { recordQuestion } from '../agent/repository.mjs';
import { revokeChannel } from '../consents/repository.mjs';
import { describePlans } from '../agent/catalog.mjs';
import { getWorkspace } from '../workspace/repository.mjs';

const questions = {
  name: '¿Cuál es tu nombre completo?',
  email: '¿Cuál es tu correo electrónico?',
  phone: '¿Cuál es tu teléfono con código de país? Ejemplo: +51912345678.',
  role: '¿Cuál es tu rol? Responde 1: estudiante, 2: padre, 3: madre o 4: apoderado.',
  beneficiary: '¿Cuál es el nombre completo del estudiante beneficiario?',
  consent:
    '¿Autorizas el seguimiento comercial por Telegram? Responde AUTORIZO o NO AUTORIZO. Puedes retirarlo con /revocar.',
  review:
    'Tu identidad necesita revisión del personal comercial para evitar duplicar o mezclar registros. Tu solicitud quedó guardada.',
  consentDenied:
    'No se habilitó seguimiento comercial. Puedes consultar los planes aquí. Para completar la captación y autorizar Telegram, escribe AUTORIZO; para mantener tu decisión, escribe NO AUTORIZO.',
};
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
async function sendReply(item, client, work) {
  const prepared = await transaction(async (db) => {
    if ((await getUpdate(db, item.updateId))?.processedAt) return null;
    const result = await work(db);
    const incoming = await recordUnassigned(result.contact, item.text);
    const message = await repository.recordReply(
      db,
      result.contact,
      incoming.id,
      result.text,
      result.participation,
    );
    if (result.participation) await recordQuestion(db, result.participation, message, 2);
    await finishUpdate(db, item.updateId, incoming.id);
    return { message, text: result.text };
  });
  if (!prepared) return;
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
    await repository.saveState(db, contact, {}, 'name', provisional);
    return {
      contact,
      text: `Hola, soy el asistente de LaPreDigital. Para ayudarte con tu preparación para la UNT necesito completar tu registro. ${questions.name}`,
    };
  });
}
async function finishOnboarding(db, state, payload, contact) {
  await repository.saveContact(db, contact, payload);
  const lead = await createLead(
    { ...payload, channel: 5, communicationChannel: 3, beneficiaryName: payload.beneficiary },
    { contactId: contact },
  );
  if (payload.consent) await repository.markChatConsent(db, contact);
  await repository.linkRequest(db, { id: state.idSolicitud, contact, lead: lead.id });
  return {
    contact,
    participation: await getParticipation(db, lead.id),
    text: 'Registro completado. ¿Qué carrera deseas preparar para la UNT y qué te gustaría saber de nuestros planes? Puedes preguntar por precios, modalidades o Explora UNT.',
  };
}
export async function continueOnboarding(item, contact, text, client) {
  const state = await transaction((db) => repository.getState(db, contact));
  if (!state) return false;
  await sendReply({ ...item, text }, client, async (db) => {
    const payload = JSON.parse(state.payload);
    const revoked =
      /^(\/revocar|no autorizo)$/i.test(text.trim()) ||
      /no me (escrib|contact)|no quiero recibir|dejen de escrib|deja de escrib/i.test(text);
    if (revoked && !['consent', 'consentDenied'].includes(state.step)) {
      for (const channel of text.trim() === '/revocar' ? [3] : [1, 2, 3])
        await revokeChannel(db, { contact, channel });
      payload.consent = false;
      await repository.saveState(db, contact, payload, state.step);
      return {
        contact,
        text: `Retiré la autorización de seguimiento indicada. Puedes continuar tu consulta respondiendo: ${questions[state.step] || questions.name}`,
      };
    }
    if (text.trim() === '/autorizar' && !['consent', 'consentDenied'].includes(state.step))
      return {
        contact,
        text: `Puedes autorizar Telegram al terminar el registro. ${questions[state.step] || questions.name}`,
      };
    if (state.step === 'expired') {
      const provisional = await repository.createRequest(db, { contact, text });
      await repository.saveState(db, contact, {}, 'name', provisional);
      return { contact, text: `Podemos iniciar una nueva solicitud. ${questions.name}` };
    }
    if (state.step === 'review') return { contact, text: questions.review };
    const answer = readAnswer(state.step, text);
    if (
      state.step === 'consentDenied' &&
      answer === null &&
      /plan|precio|cuesta|incluye|ruta|meta|explora/i.test(text)
    )
      return { contact, text: describePlans(text, (await getWorkspace()).tariffs) };
    if (answer === null) return { contact, text: questions[state.step] };
    payload[state.step === 'consentDenied' ? 'consent' : state.step] = answer;
    if (payload.role === 1) payload.beneficiary = payload.name;
    let step =
      ['name', 'email', 'phone', 'role', 'beneficiary', 'consent'].find(
        (key) => payload[key] === undefined,
      ) ?? 'complete';
    if (step === 'complete') {
      if (!payload.consent && !(await findConsent(db, { contact })).recordset.length) {
        await repository.saveState(db, contact, payload, 'consentDenied');
        return { contact, text: questions.consentDenied };
      }
      const match = await findContacts(db, payload);
      const candidates = await findBeneficiaryByName(db, payload.beneficiary.toUpperCase());
      if (match.recordset.some((row) => row.id !== contact) || candidates.length) step = 'review';
      else return finishOnboarding(db, state, payload, contact);
    }
    await repository.saveState(db, contact, payload, step);
    return { contact, text: questions[step] };
  });
  return true;
}
export async function onboardingQuestion(contact) {
  const state = await transaction((db) => repository.getState(db, contact));
  return state
    ? questions[state.step] || 'Tu solicitud anterior venció. Escribe para iniciar una nueva.'
    : null;
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
      communicationChannel: 2,
    };
    const match = await findContacts(db, payload);
    const contact = match.recordset[0]?.id || state.idContacto;
    if (contact !== state.idContacto) {
      if (await repository.hasChat(db, contact))
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
