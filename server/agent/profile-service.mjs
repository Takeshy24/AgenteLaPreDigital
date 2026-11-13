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
import { getPolicy } from './policy.mjs';
import { answerFromKnowledge } from './knowledge.mjs';
import { knowledgeFragments, NO_INFORMATION } from '../knowledge/service.mjs';
import { buildDataRecommendation } from './recommendations.mjs';
import { summarizePlan } from './plan-summary.mjs';

async function queueCourses(db, participation, replyTo, selected, { text, question = false } = {}) {
  const messageId = await createReply(
    db,
    participation,
    text ?? flow.courseSelectionText(selected),
    replyTo,
  );
  if (question)
    await repository.recordQuestion(db, participation, messageId, flow.QUESTIONS.courses.field);
  await repository.attachMarkup(db, messageId, {
    inline_keyboard: flow.keyboard(participation.idLeadCaso, 'courses', [], undefined, selected),
    course_selection: { selected, completed: false },
  });
  return messageId;
}

// Deja en cola el siguiente paso: la pregunta de perfil que falta o, con el perfil completo, la
// recomendación. El despacho lo envía con sus botones y queda registrado como mensaje saliente.
export async function queueNextStep(
  db,
  participation,
  replyTo,
  { intro = '', recommendationOnly = false } = {},
) {
  const profile = await repository.getProfile(db, participation.idLeadCaso);
  const policy = await getPolicy(db);
  if (!policy.profileQuestions && !recommendationOnly)
    return createReply(db, participation, '¡Hola! ¿En qué puedo ayudarte?', replyTo);
  const tariffs = await publicTariffs(db);
  const selection = policy.optionalQuestions
    ? await repository.getCourseSelection(db, participation.idLeadCaso)
    : null;
  const next = flow.nextKey(profile, policy);
  const resumeCourses =
    selection && !selection.completed && !profile.courses && !flow.isCoreKey(next);
  const key = recommendationOnly ? null : resumeCourses ? 'courses' : next;
  const aud = flow.audience(profile.role, profile.beneficiary);
  if (key) {
    if (key === 'courses')
      return queueCourses(db, participation, replyTo, resumeCourses ? selection.selected : [], {
        text: resumeCourses
          ? intro + flow.courseSelectionText(selection.selected)
          : `${intro}${flow.questionText(key, aud)}\n${flow.COURSE_SELECTION_HELP}`,
        question: !resumeCourses,
      });
    const { field } = flow.QUESTIONS[key];
    const messageId = await createReply(
      db,
      participation,
      intro + flow.questionText(key, aud),
      replyTo,
    );
    await repository.recordQuestion(db, participation, messageId, field);
    await repository.attachMarkup(db, messageId, {
      inline_keyboard: flow.keyboard(participation.idLeadCaso, key, tariffs, aud),
    });
    return messageId;
  }
  if (!policy.recommendAfterProfile)
    return createReply(
      db,
      participation,
      'Gracias por compartir tus datos. ¿Qué te gustaría consultar?',
      replyTo,
    );
  const dataRecommendation = policy.useLeadData
    ? await buildDataRecommendation(db, profile, tariffs, aud, {
        excludeBeneficiary: participation.idBeneficiario,
      })
    : null;
  const recommendation = dataRecommendation ?? flow.recommend(profile, tariffs, aud);
  const answer = answerFromKnowledge(
    `Qué incluye ${recommendation.tariff?.plan ?? 'Explora UNT'}`,
    [],
    await knowledgeFragments(),
  );
  const summary = answer
    ? summarizePlan(answer.text, recommendation.tariff?.plan ?? 'Explora UNT')
    : '';
  const messageId = await createReply(
    db,
    participation,
    dataRecommendation
      ? `${intro}${dataRecommendation.text}`
      : summary
        ? `${intro}${recommendation.text}\n\n${summary}${recommendation.tariff ? '\n\nConsulta el detalle en «Ver qué incluye».' : ''}`
        : NO_INFORMATION,
    replyTo,
  );
  if (dataRecommendation ? !dataRecommendation.hasInformation : !summary) return messageId;
  const menu = dataRecommendation?.alternatives.length
    ? [
        ...dataRecommendation.alternatives.map((tariff) => [
          {
            text: `Elegir ${tariff.plan}`,
            callback_data: `pf:${participation.idLeadCaso}:p:${tariff.id}`,
          },
          {
            text: `Ver ${tariff.plan}`,
            callback_data: `pf:${participation.idLeadCaso}:i:${tariff.id}`,
          },
        ]),
        [{ text: 'Probar Explora gratis', callback_data: `pf:${participation.idLeadCaso}:t` }],
      ]
    : flow.recommendationKeyboard(participation.idLeadCaso, recommendation.tariff);
  const buttons = menu
    .filter((row) =>
      row.every((button) => {
        const letter = flow.parseCallback(button.callback_data)?.letter;
        return letter !== 'p' || policy.proposalLinks;
      }),
    )
    .filter((row) =>
      row.every(
        (button) => flow.parseCallback(button.callback_data)?.letter !== 't' || policy.trialLinks,
      ),
    );
  await repository.attachMarkup(db, messageId, {
    inline_keyboard: buttons,
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
    if (key === 'courses') return answerCourses(db, participation, parsed, { text, channel });
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

async function answerCourses(db, participation, parsed, { text, channel }) {
  const id = participation.idLeadCaso;
  const selection = await repository.getCourseSelection(db, id);
  if (!selection) throw new BusinessError('La selección de cursos no está abierta.');
  if (selection.completed) return { alreadyAnswered: true };
  const options = flow.optionsFor('courses');
  const option = options[Number(parsed.index)];
  if (!['x', 'ok'].includes(parsed.index) && !option) throw new BusinessError('Opción no válida.');
  const incoming = await recordIncoming(
    id,
    {
      text:
        text ??
        (parsed.index === 'ok'
          ? `Cursos difíciles: ${selection.selected.join(', ') || 'sin seleccionar'}. Listo.`
          : parsed.index === 'x'
            ? 'Cursos difíciles: otra respuesta'
            : `Cursos difíciles: ${option.value}`),
      channel,
      level: 1,
    },
    { source: 2 },
  );
  if (parsed.index === 'x') {
    const reply = await createReply(
      db,
      participation,
      'Escríbeme los cursos juntos, separados por comas. Los añadiré a los que ya marcaste.',
      incoming.id,
    );
    await repository.attachMarkup(db, reply, {
      remove_keyboard: true,
      course_selection: { selected: selection.selected, completed: false },
    });
    return { other: 'courses', messageId: incoming.id };
  }
  if (parsed.index === 'ok' || option.value === flow.NO_COURSES) {
    if (parsed.index === 'ok' && !selection.selected.length) {
      await queueCourses(db, participation, incoming.id, [], {
        text: 'Marca al menos un curso o elige «Ninguno en especial» para continuar.',
      });
      return { selecting: 'courses', messageId: incoming.id };
    }
    if (parsed.index === 'ok')
      await saveProfile(
        id,
        { fields: { courses: selection.selected }, channel },
        { messageId: incoming.id },
      );
    await repository.completeCourseSelection(db, selection);
    await queueNextStep(db, await getParticipation(db, id), incoming.id, {
      intro: flow.ACKNOWLEDGEMENT.courses,
    });
    return { answered: 'courses', messageId: incoming.id };
  }
  await queueCourses(
    db,
    participation,
    incoming.id,
    flow.toggleCourse(selection.selected, option.value),
  );
  return { selecting: 'courses', messageId: incoming.id };
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
  const wanted = flow.normalizeLabel(text).replace(/^✓\s*/, '');
  const buttons = (markup?.inline_keyboard ?? []).flat();
  const button = data
    ? buttons.find((item) => item.callback_data === data)
    : buttons.find(
        (item) =>
          flow.normalizeLabel(item.text).replace(/^✓\s*/, '') === wanted ||
          flow.normalizeLabel(item.text.slice(0, 24)).replace(/^✓\s*/, '') === wanted,
      );
  const parsed = button ? flow.parseCallback(button.callback_data) : null;
  if (!parsed || parsed.participationId !== participationId) return null;
  if (['c', 'a', 'b', 'd', 'e'].includes(parsed.letter)) {
    const profile = await repository.getProfile(db, participationId);
    const key = flow.KEY_BY_LETTER[parsed.letter];
    if (profile[key] != null && String(profile[key]).trim() !== '') return null;
  }
  return parsed;
}
