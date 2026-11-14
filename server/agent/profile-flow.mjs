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

const COURSES = [
  'Razonamiento matemático',
  'Matemática',
  'Física',
  'Química',
  'Biología',
  'Lenguaje y razonamiento verbal',
];
export const NO_COURSES = 'Ninguno en especial';
// WhatsApp solo deja elegir una opción por lista: cada curso elegido se anota y se vuelven a
// mostrar las opciones para elegir otro.
export const COURSE_SELECTION_HELP =
  'Elige un curso en las opciones; después puedes elegir otro, uno por vez. Cuando termines, elige «Listo». También puedes escribir los cursos juntos, por ejemplo: «Física y Química».';
const APPLICATIONS = [
  ['Es mi primera vez', 'Es su primera vez', 'Primera postulación (no postuló antes)'],
  ['Ya postulé una vez', 'Ya postuló una vez', 'Postuló una vez'],
  ['Postulé dos veces o más', 'Postuló dos veces o más', 'Postuló dos veces o más'],
];

// A quién se habla (tabla 3: rol del contacto). El estudiante recibe un trato directo; la madre,
// el padre o el apoderado reciben las mismas preguntas referidas al estudiante por su nombre.
export function audience(role, beneficiary) {
  const first = String(beneficiary ?? '')
    .trim()
    .split(/\s+/)[0];
  return { student: !role || Number(role) === 1, name: first || 'el estudiante' };
}
const STUDENT = audience(1);

export const OTHER_ANSWER_PROMPT = '¡Claro! Escríbeme tu respuesta en un mensaje y la anoto.';

// Se antepone a la siguiente pregunta cuando la respuesta llegó con un botón.
export const ACKNOWLEDGEMENT = {
  career: '¡Excelente elección! ',
  availability: '¡Perfecto! Ya casi terminamos. ',
  courses: '¡Anotado! ',
};

export const QUESTIONS = {
  career: {
    name: 'Carrera',
    letter: 'c',
    field: 2,
    text: '¿Qué carrera te gustaría estudiar?',
    other: (name) => `¿Qué carrera le gustaría estudiar a ${name}?`,
  },
  availability: {
    name: 'Disponibilidad',
    letter: 'a',
    field: 6,
    text: '¿Cuánto tiempo puedes dedicar a estudiar?',
    other: (name) => `¿Cuánto tiempo puede dedicar ${name} a estudiar?`,
  },
  budget: {
    name: 'Presupuesto',
    letter: 'b',
    field: 7,
    text: '¿Cuánto podrías invertir al mes en tu preparación? Es solo para recomendarte lo que mejor te convenga.',
    other: (name) =>
      `¿Cuánto podrían invertir al mes en la preparación de ${name}? Es solo para recomendarles lo que mejor le convenga.`,
  },
  courses: {
    name: 'Cursos difíciles',
    letter: 'd',
    field: 3,
    text: 'Para afinar la recomendación, dos preguntas opcionales: ¿qué cursos se te hacen más difíciles?',
    other: (name) =>
      `Para afinar la recomendación, dos preguntas opcionales: ¿qué cursos se le hacen más difíciles a ${name}?`,
  },
  applications: {
    name: 'Postulaciones anteriores',
    letter: 'e',
    field: 4,
    text: '¿Ya postulaste antes a la UNT?',
    other: (name) => `¿${name} ya postuló antes a la UNT?`,
  },
};
export const questionText = (key, aud = STUDENT) =>
  aud.student ? QUESTIONS[key].text : QUESTIONS[key].other(aud.name);
// Las tres primeras son necesarias para recomendar; las opcionales (tabla 3, necesidades
// académicas) se preguntan una sola vez y solo si el dato no se conoce.
const ORDER = ['career', 'availability', 'budget'];
const OPTIONAL = ['courses', 'applications'];
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
export function optionsFor(key, tariffs = [], aud = STUDENT) {
  if (key === 'career') return CAREERS.map((label) => ({ label, value: label }));
  if (key === 'availability') return AVAILABILITY.map((label) => ({ label, value: label }));
  if (key === 'courses') return [...COURSES, NO_COURSES].map((label) => ({ label, value: label }));
  if (key === 'applications')
    return APPLICATIONS.map(([mine, theirs, value]) => ({
      label: aud.student ? mine : theirs,
      value,
    }));
  const caps = [...new Set(monthly(tariffs).map((tariff) => Math.ceil(Number(tariff.precio))))];
  return caps.map((cap, index) => ({
    label: index === caps.length - 1 ? `S/ ${cap} o más` : `Hasta S/ ${cap}`,
    value: String(cap),
  }));
}

export function keyboard(participationId, key, tariffs, aud = STUDENT, selected = []) {
  const { letter } = QUESTIONS[key];
  const buttons = optionsFor(key, tariffs, aud).map((option, index) => ({
    text:
      key === 'courses'
        ? `${selected.includes(option.value) ? '✓ ' : ''}${option.label
            .replace('Razonamiento matemático', 'Razon. matemático')
            .replace('Lenguaje y razonamiento verbal', 'Lenguaje / R. verbal')}`
        : option.label,
    callback_data: `pf:${participationId}:${letter}:${index}`,
  }));
  const rows = [];
  for (let index = 0; index < buttons.length; index += 2)
    rows.push(buttons.slice(index, index + 2));
  if (key !== 'budget')
    rows.push([{ text: 'Otra respuesta', callback_data: `pf:${participationId}:${letter}:x` }]);
  if (key === 'courses')
    rows.push([{ text: 'Listo', callback_data: `pf:${participationId}:d:ok` }]);
  return rows;
}

export function toggleCourse(selected, course) {
  return selected.includes(course)
    ? selected.filter((item) => item !== course)
    : [...selected, course];
}

// Texto que acompaña a las opciones mientras se eligen cursos. Sin cursos anotados repite la
// pregunta para que el mensaje se entienda solo.
export function courseSelectionText(selected, question = '¿Qué cursos te resultan más difíciles?') {
  if (!selected.length) return `${question}\n${COURSE_SELECTION_HELP}`;
  return `Anoté: ${selected.join(', ')}. Si hay otros cursos difíciles, elígelos en las opciones, uno por vez; si no, elige «Listo» para continuar.`;
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
  const match = /^pf:(\d+):([cabdepti])(?::(\d+|x|ok))?$/.exec(data ?? '');
  if (!match) return null;
  if (match[3] === 'ok' && match[2] !== 'd') return null;
  return { participationId: Number(match[1]), letter: match[2], index: match[3] ?? null };
}

const missing = (profile, key) => profile[key] == null || String(profile[key]).trim() === '';
export function nextKey(profile, { questionOrder = ORDER, optionalQuestions = true } = {}) {
  const core = questionOrder.find((key) => missing(profile, key));
  if (core) return core;
  if (!optionalQuestions) return null;
  const asked = String(profile.asked ?? '').split(',');
  return (
    OPTIONAL.find(
      (key) => missing(profile, key) && !asked.includes(String(QUESTIONS[key].field)),
    ) ?? null
  );
}
export const isCoreKey = (key) => ORDER.includes(key);

export function greeting(name, aud = STUDENT) {
  const first = String(name ?? '')
    .trim()
    .split(/\s+/)[0];
  const hello = first ? `¡Hola, ${first}! 😊` : '¡Hola! 😊';
  return aud.student
    ? `${hello} Qué gusto tenerte por aquí. Soy el asistente de LaPreDigital y te voy a ayudar a encontrar el plan que mejor se adapte a ti. Para conocerte un poquito, te haré unas preguntas cortas. `
    : `${hello} Qué gusto tenerte por aquí. Soy el asistente de LaPreDigital y te voy a ayudar a encontrar el plan que mejor se adapte a ${aud.name}. Para conocer un poquito más sobre su preparación, te haré unas preguntas cortas. `;
}

export function welcomeBack(name) {
  const first = String(name ?? '')
    .trim()
    .split(/\s+/)[0];
  return `¡Qué bueno verte de nuevo${first ? `, ${first}` : ''}! 😊 Sigamos donde nos quedamos. `;
}

// Recomienda el plan mensual más completo que cabe en el presupuesto declarado.
export function recommend(profile, tariffs, aud = STUDENT) {
  const budget = Number(profile.budget);
  const fits = monthly(tariffs).filter((tariff) => Number(tariff.precio) <= budget);
  const chosen = fits.at(-1);
  const recipient = aud.student ? 'ti' : aud.name;
  return {
    text: chosen
      ? `Para ${recipient}, recomiendo ${chosen.plan}: cabe en el presupuesto de S/ ${budget} al mes.`
      : `Con ese presupuesto, podemos revisar Explora UNT para ${recipient}.`,
    tariff: chosen ?? null,
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
