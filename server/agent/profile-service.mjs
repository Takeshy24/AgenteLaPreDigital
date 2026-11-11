import { transaction } from '../db.mjs';
import { createReply } from '../integrations/repository.mjs';
import { recordIncoming } from '../messages/service.mjs';
import { saveProfile } from '../profiles/service.mjs';
import { publicTariffs } from '../public/repository.mjs';
import { BusinessError } from '../shared/errors.mjs';
import { getParticipation } from '../shared/repository.mjs';
import * as flow from './profile-flow.mjs';
import * as repository from './repository.mjs';
import { actOnAnalysis } from './service.mjs';

// Deja en cola el siguiente paso: la pregunta de perfil que falta o, con el perfil completo, la
// recomendación. El despacho lo envía con sus botones y queda registrado como mensaje saliente.
export async function queueNextStep(db, participation, replyTo, { intro = '' } = {}) {
  const profile = await repository.getProfile(db, participation.idLeadCaso);
  const tariffs = await publicTariffs(db);
  const key = flow.nextKey(profile);
  if (key) {
    const { text, field } = flow.QUESTIONS[key];
    const messageId = await createReply(db, participation, intro + text, replyTo);
    await repository.recordQuestion(db, participation, messageId, field);
    await repository.attachMarkup(db, messageId, {
      inline_keyboard: flow.keyboard(participation.idLeadCaso, key, tariffs),
    });
    return messageId;
  }
  const recommendation = flow.recommend(profile, tariffs);
  const messageId = await createReply(db, participation, intro + recommendation.text, replyTo);
  await repository.attachMarkup(db, messageId, {
    inline_keyboard: flow.recommendationKeyboard(participation.idLeadCaso, recommendation.tariff),
  });
  return messageId;
}

export async function answerProfile(participationId, parsed, { text, channel = 3 } = {}) {
  return transaction(async (db) => {
    const participation = await getParticipation(db, participationId);
    if (participation.idEstadoCaso !== 1) throw new BusinessError('El caso está cerrado.');
    const key = flow.KEY_BY_LETTER[parsed.letter];
    const { name } = flow.QUESTIONS[key];
    const profile = await repository.getProfile(db, participationId);
    if (profile[key] != null && String(profile[key]).trim() !== '')
      return { alreadyAnswered: true };
    if (parsed.index === 'x') {
      const repeated =
        (await repository.lastOutgoingText(db, participationId)) === flow.OTHER_ANSWER_PROMPT;
      if (repeated && !text) return { other: key, repeated: true };
      const incoming = await recordIncoming(
        participationId,
        { text: text ?? `${name}: otra respuesta`, channel, level: 1 },
        { source: 2 },
      );
      if (!repeated) {
        const reply = await createReply(db, participation, flow.OTHER_ANSWER_PROMPT, incoming.id);
        await repository.attachMarkup(db, reply, { remove_keyboard: true });
      }
      return { other: key, repeated, messageId: incoming.id };
    }
    const option = flow.optionsFor(key, await publicTariffs(db))[Number(parsed.index)];
    if (!option) throw new BusinessError('Opción no válida.');
    const incoming = await recordIncoming(
      participationId,
      { text: text ?? `${name}: ${option.label}`, channel, level: 1 },
      { source: 2 },
    );
    await saveProfile(
      participationId,
      { fields: { [key]: key === 'budget' ? Number(option.value) : option.value }, channel },
      { messageId: incoming.id },
    );
    await queueNextStep(db, await getParticipation(db, participationId), incoming.id, {
      intro: flow.ACKNOWLEDGEMENT[key] ?? '',
    });
    return { answered: key, messageId: incoming.id };
  });
}

// Botones de la recomendación: cada uno equivale a que la persona escriba esa petición, así que se
// registra como mensaje entrante y pasa por las mismas reglas que un mensaje escrito.
export async function answerAction(participationId, parsed, { text, channel = 3 } = {}) {
  return transaction(async (db) => {
    const tariffs = await publicTariffs(db);
    const tariff = tariffs.find((item) => item.id === Number(parsed.index));
    if (['p', 'i'].includes(parsed.letter) && !tariff) throw new BusinessError('Plan no vigente.');
    const request = {
      p: {
        text: `Quiero la propuesta de ${tariff?.plan} ${tariff?.modalidad?.toLowerCase()}`,
        level: 3,
        action: 'proposal',
      },
      t: { text: 'Quiero probar Explora UNT', level: 3, action: 'trial' },
      i: { text: `Quiero saber qué incluye ${tariff?.plan}`, level: 2, action: 'catalog' },
    }[parsed.letter];
    const incoming = await recordIncoming(
      participationId,
      { text: text ?? request.text, channel, level: request.level },
      { source: 2 },
    );
    await actOnAnalysis(participationId, incoming.id, request.text, {
      level: request.level,
      retraction: false,
      action: request.action,
      tariffId: tariff?.id ?? null,
      fields: [],
      understood: true,
      needsGuardian: false,
      guardian: null,
    });
    return { action: request.action, messageId: incoming.id };
  });
}

// Un botón del teclado de respuesta llega como texto normal. Se reconoce comparándolo con los
// botones del último mensaje del agente, así que no depende de listas duplicadas ni de Ollama.
export async function matchKeyboardReply(db, participationId, text, { data = null } = {}) {
  const markup = data
    ? await repository.findRecentButton(db, participationId, data)
    : await repository.lastOutgoingMarkup(db, participationId);
  const wanted = flow.normalizeLabel(text);
  const buttons = (markup?.inline_keyboard ?? []).flat();
  const button = data
    ? buttons.find((item) => item.callback_data === data)
    : buttons.find(
        (item) =>
          flow.normalizeLabel(item.text) === wanted ||
          flow.normalizeLabel(item.text.slice(0, 24)) === wanted,
      );
  const parsed = button ? flow.parseCallback(button.callback_data) : null;
  if (!parsed || parsed.participationId !== participationId) return null;
  if (['c', 'a', 'b'].includes(parsed.letter)) {
    const profile = await repository.getProfile(db, participationId);
    const key = flow.KEY_BY_LETTER[parsed.letter];
    if (profile[key] != null && String(profile[key]).trim() !== '') return null;
  }
  return parsed;
}
