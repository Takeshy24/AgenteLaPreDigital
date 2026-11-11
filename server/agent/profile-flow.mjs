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

export const QUESTIONS = {
  career: { name: 'Carrera', letter: 'c', field: 2, text: '¿Qué carrera quieres estudiar?' },
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
    text: '¿Cuánto podrías invertir al mes en tu preparación?',
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
  return `${first ? `¡Hola, ${first}!` : '¡Hola!'} Ya estás conectado con LaPreDigital. Para recomendarte el plan que mejor se ajusta a ti, te haré unas preguntas rápidas. `;
}

// Recomienda el plan mensual más completo que cabe en el presupuesto declarado.
export function recommend(profile, tariffs) {
  const budget = Number(profile.budget);
  const fits = monthly(tariffs).filter((tariff) => Number(tariff.precio) <= budget);
  const chosen = fits.at(-1);
  const summary = `${profile.career}, ${String(profile.availability).toLowerCase()}, hasta S/ ${budget} al mes`;
  if (!chosen)
    return {
      text: `Con lo que me contaste (${summary}), lo mejor para empezar es Explora UNT: 14 días gratis, una vez por estudiante. Después revisamos juntos qué plan te conviene.`,
      tariff: null,
    };
  const semester = tariffs.find(
    (tariff) => tariff.plan === chosen.plan && tariff.modalidad === 'Semestral',
  );
  const prices = `S/ ${Number(chosen.precio).toFixed(2)} al mes${semester ? ` o S/ ${Number(semester.precio).toFixed(2)} el semestre` : ''}`;
  return {
    text: `Con lo que me contaste (${summary}), te recomiendo ${chosen.plan}: ${prices}. También puedes empezar con Explora UNT, 14 días gratis, una vez por estudiante.`,
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
