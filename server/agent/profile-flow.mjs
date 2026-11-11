// Preguntas de perfil con botones: una por mensaje, de la más fácil a la más sensible, hasta poder
// recomendar un plan. Las opciones son atajos: la persona siempre puede escribir su respuesta.
const CAREERS = [
  'Medicina Humana',
  'Ingeniería de Sistemas',
  'Derecho',
  'Psicología',
  'Administración',
];
const AVAILABILITY = [
  '1 a 2 horas al día',
  '3 a 4 horas al día',
  '5 horas o más al día',
  'Solo fines de semana',
];

export const OTHER_ANSWER_PROMPT = '¡Claro! Escríbeme tu respuesta en un mensaje y la anoto.';

// Se antepone a la siguiente pregunta cuando la respuesta llegó con un botón.
export const ACKNOWLEDGEMENT = {
  career: '¡Excelente elección! ',
  availability: '¡Perfecto! Ya casi terminamos. ',
};

export const QUESTIONS = {
  career: { name: 'Carrera', letter: 'c', field: 2, text: '¿Qué carrera te gustaría estudiar?' },
  availability: {
    name: 'Disponibilidad',
    letter: 'a',
    field: 6,
    text: '¿Cuánto tiempo puedes dedicar a estudiar?',
  },
  budget: {
    name: 'Presupuesto',
    letter: 'b',
    field: 7,
    text: '¿Cuánto podrías invertir al mes en tu preparación? Es solo para recomendarte lo que mejor te convenga.',
  },
};
const ORDER = ['career', 'availability', 'budget'];
export const KEY_BY_LETTER = Object.fromEntries(
  Object.entries(QUESTIONS).map(([key, question]) => [question.letter, key]),
);
export const KEY_BY_FIELD = Object.fromEntries(
  Object.entries(QUESTIONS).map(([key, question]) => [question.field, key]),
);

const tariffId = (tariff) => tariff.idPlanTarifa ?? tariff.id;
const monthly = (tariffs) =>
  tariffs
    .filter((tariff) => tariff.modalidad === 'Mensual')
    .sort((a, b) => Number(a.precio) - Number(b.precio));

// Los topes de presupuesto salen de las tarifas vigentes, no de cifras escritas aquí.
export function optionsFor(key, tariffs = []) {
  if (key === 'career') return CAREERS.map((label) => ({ label, value: label }));
  if (key === 'availability') return AVAILABILITY.map((label) => ({ label, value: label }));
  const caps = [...new Set(monthly(tariffs).map((tariff) => Math.ceil(Number(tariff.precio))))];
  return caps.map((cap, index) => ({
    label: index === caps.length - 1 ? `S/ ${cap} o más` : `Hasta S/ ${cap}`,
    value: String(cap),
  }));
}

export function keyboard(participationId, key, tariffs) {
  const { letter } = QUESTIONS[key];
  const buttons = optionsFor(key, tariffs).map((option, index) => ({
    text: option.label,
    callback_data: `pf:${participationId}:${letter}:${index}`,
  }));
  const rows = [];
  for (let index = 0; index < buttons.length; index += 2)
    rows.push(buttons.slice(index, index + 2));
  if (key !== 'budget')
    rows.push([{ text: 'Otra respuesta', callback_data: `pf:${participationId}:${letter}:x` }]);
  return rows;
}

// Telegram muestra estos botones como teclado de respuesta: al pulsar uno, el texto se envía como
// un mensaje de la propia persona. Se guardan con su callback_data para saber qué significa cada uno.
export function replyMarkup(markup) {
  if (markup?.remove_keyboard) return { remove_keyboard: true };
  return {
    keyboard: (markup?.inline_keyboard ?? []).map((row) =>
      row.map((button) => ({ text: button.text })),
    ),
    resize_keyboard: true,
    one_time_keyboard: true,
    input_field_placeholder: 'Elige una opción o escribe tu respuesta',
  };
}

export const normalizeLabel = (value) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

export function parseCallback(data) {
  const match = /^pf:(\d+):([cabpti])(?::(\d+|x))?$/.exec(data ?? '');
  if (!match) return null;
  return { participationId: Number(match[1]), letter: match[2], index: match[3] ?? null };
}

export function nextKey(profile) {
  return ORDER.find((key) => profile[key] == null || String(profile[key]).trim() === '') ?? null;
}

export function greeting(name) {
  const first = String(name ?? '')
    .trim()
    .split(/\s+/)[0];
  return `${first ? `¡Hola, ${first}! 😊` : '¡Hola! 😊'} Qué gusto tenerte por aquí. Soy el asistente de LaPreDigital y te voy a ayudar a encontrar el plan que mejor se adapte a ti. Para conocerte un poquito, te haré unas preguntas cortas. `;
}

export function welcomeBack(name) {
  const first = String(name ?? '')
    .trim()
    .split(/\s+/)[0];
  return `¡Qué bueno verte de nuevo${first ? `, ${first}` : ''}! 😊 Sigamos donde nos quedamos. `;
}

// Recomienda el plan mensual más completo que cabe en el presupuesto declarado.
export function recommend(profile, tariffs) {
  const budget = Number(profile.budget);
  const fits = monthly(tariffs).filter((tariff) => Number(tariff.precio) <= budget);
  const chosen = fits.at(-1);
  const summary = `${profile.career}, ${String(profile.availability).toLowerCase()}, hasta S/ ${budget} al mes`;
  if (!chosen)
    return {
      text: `¡Gracias por contarme! Con lo que me compartiste (${summary}), lo mejor para empezar es Explora UNT: 14 días gratis, una vez por estudiante. Después vemos juntos qué plan te conviene.`,
      tariff: null,
    };
  const semester = tariffs.find(
    (tariff) => tariff.plan === chosen.plan && tariff.modalidad === 'Semestral',
  );
  const prices = `S/ ${Number(chosen.precio).toFixed(2)} al mes${semester ? ` o S/ ${Number(semester.precio).toFixed(2)} el semestre` : ''}`;
  return {
    text: `¡Listo, gracias por contarme! Con lo que me compartiste (${summary}), creo que lo que mejor te va es ${chosen.plan}: ${prices}. Si quieres, también puedes empezar probando Explora UNT gratis por 14 días (una vez por estudiante).`,
    tariff: chosen,
  };
}

export function recommendationKeyboard(participationId, tariff) {
  const rows = [];
  if (tariff)
    rows.push([
      { text: 'Quiero la propuesta', callback_data: `pf:${participationId}:p:${tariffId(tariff)}` },
    ]);
  rows.push([{ text: 'Probar Explora gratis', callback_data: `pf:${participationId}:t` }]);
  if (tariff)
    rows.push([
      { text: 'Ver qué incluye', callback_data: `pf:${participationId}:i:${tariffId(tariff)}` },
    ]);
  return rows;
}
