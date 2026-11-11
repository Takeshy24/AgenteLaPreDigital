// Reglas de intención que complementan al modelo local: cuando el texto es explícito, el sistema
// no depende de que un modelo pequeño lo clasifique bien. El modelo propone; estas reglas deciden
// solo en los casos claros (sección 2.5, tabla 5; 2.2 derivación; F3 perfil; F4 responsable).
// Todas las búsquedas usan palabras completas: «caro» no coincide con «Carolina».
import { mentionedPlans, retrieve } from './knowledge.mjs';

// Texto en minúsculas, sin tildes y con espacios alrededor de cada palabra.
export const words = (text) =>
  ` ${String(text ?? '')
    .toLowerCase()
    .normalize('NFD')
    .split('')
    .filter((char) => char.charCodeAt(0) < 0x300 || char.charCodeAt(0) > 0x36f)
    .join('')
    .replace(/[^a-z0-9/]+/g, ' ')
    .trim()} `;

const DESIRE = '(quiero|quisiera|deseo|necesito|me gustaria|voy a|vamos a)';
const BUY =
  '(pagar|pagarlo|contratar|contratarlo|comprar|comprarlo|adquirir|adquirirlo|inscribir|inscribirme|inscribirlo|inscribirla|matricular|matricularme|matricularlo|matricularla)';
const PURCHASE = new RegExp(` ${DESIRE} ([a-z0-9 ]* )?${BUY} `);
const NEGATED = / (no|ya no|nunca) ([a-z ]* )?(quiero|deseo|voy a|necesito|me interesa) /;
const RETRACTION =
  / (ya no (quiero|me interesa|voy)|no me interesa|no quiero (contratar|comprar|pagar|el plan|la propuesta)|por ahora no|no voy a (contratar|comprar|pagar)|desisto) /;
const PAYMENT_ASK =
  / ((medios?|formas?|metodos?) de pago|como (puedo |se |lo |la )?(pago|pagar|compro|comprar|adquiero|adquirir|inscribo|contrato)|como (hago|realizo|hacemos) (el )?pago|(puedo|se puede) pagar|pagar con (tarjeta|yape|plin|transferencia|efectivo|deposito)|donde (pago|puedo pagar|se paga)|aceptan (yape|plin|tarjeta|tarjetas|transferencia|deposito)|yape|plin|(link|enlace) (de|para) (pago|pagar)|(pasa|pasame|pasas|envia|enviame|manda|mandame) (el )?(link|enlace)) /;
const TRIAL = new RegExp(
  ` (${DESIRE.slice(1, -1)}|activar|activenme|activen|activa|activame|probar) ([a-z0-9 ]* )?(explora|prueba gratis|probar gratis|prueba gratuita|la prueba) `,
);
const TRIAL_WORDS = / (explora|prueba|probar) /;
const OBJECTION =
  / (caro|cara|carisimo|carisima|barato|barata|economico|economica|accesible|costoso|costosa|no me alcanza) /;
const RELATIVE =
  '(mama|madre|papa|padre|padres|apoderado|apoderada|tutor|tutora|abuelo|abuela|tio|tia|hermano|hermana)';
const GUARDIAN = new RegExp(
  ` (${RELATIVE} ([a-z ]* )?(paga|pagan|pagara|decide|deciden|decidira)|(paga|pagan|decide|deciden) ([a-z ]* )?${RELATIVE}|no puedo decidir|no decido yo|depende de mis padres|tengo que consultarlo|consultarlo con) `,
);
const QUESTION_START =
  /^ (q|k|ke|que|cuanto|cuantos|cuantas|como|tienen|hay|incluye|incluyen|puedo|se puede|cual|cuales|donde) /;
const CAREER_CUE =
  / (estudiar|estudie|estudiare|carrera|postular|postulo|postulando|postula|ingresar|ser|me interesa|seguir|quiere|quiero) /;
const CAREERS = [
  'Medicina Humana',
  'Medicina',
  'Derecho',
  'Enfermería',
  'Estomatología',
  'Farmacia',
  'Psicología',
  'Administración',
  'Contabilidad',
  'Economía',
  'Arquitectura',
  'Educación',
  'Ingeniería de Sistemas',
  'Ingeniería Civil',
  'Ingeniería Industrial',
  'Ingeniería Agroindustrial',
  'Ingeniería Química',
  'Ingeniería Mecánica',
  'Biología',
  'Trabajo Social',
  'Ciencias de la Comunicación',
];

export function resolveTariff(text, tariffs) {
  const value = words(text);
  const names = [...new Set(tariffs.map((tariff) => tariff.plan))].sort(
    (a, b) => b.length - a.length,
  );
  const plan =
    names.find((name) => value.includes(words(name))) ??
    (value.includes(' plus ')
      ? 'Meta UNT Plus'
      : value.includes(' meta ')
        ? 'Meta UNT'
        : value.includes(' ruta ')
          ? 'Ruta UNT'
          : null);
  if (!plan) return null;
  const options = tariffs.filter((tariff) => tariff.plan === plan);
  const period = / (semestral|semestre) /.test(value)
    ? 'semestral'
    : / (mensual|al mes|por mes) /.test(value)
      ? 'mensual'
      : null;
  const chosen = period
    ? options.find((tariff) => words(tariff.modalidad).trim() === period)
    : options.length === 1
      ? options[0]
      : null;
  return chosen?.idPlanTarifa ?? null;
}

export const isPurchaseRequest = (text) => PURCHASE.test(words(text)) && !NEGATED.test(words(text));
export const isTrialRequest = (text) => TRIAL.test(words(text));
export const isObjection = (text) => OBJECTION.test(words(text));
export const isPaymentQuestion = (text) => PAYMENT_ASK.test(words(text));
export const isRetraction = (text) => RETRACTION.test(words(text));
export const needsGuardianText = (text) => GUARDIAN.test(words(text));
const isQuestion = (text) => /[?¿]/.test(text) || QUESTION_START.test(words(text));

// Datos del responsable escritos en un mensaje: nombre (tras «se llama»), relación y teléfono +51.
export function extractGuardian(text) {
  const value = words(text);
  const role = / (mama|madre) /.test(value)
    ? 3
    : / (papa|padre) /.test(value)
      ? 2
      : / (apoderado|apoderada|tutor|tutora) /.test(value)
        ? 4
        : null;
  const phone = /\+51[\s-]*9(?:[\s-]*\d){8}/.exec(text)?.[0];
  const name =
    /(?:se llama|su nombre es|nombre:)\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+){1,3})/.exec(
      text,
    )?.[1];
  if (!role || !phone || !name) return null;
  return {
    name,
    phone: '+51' + phone.replace(/[^0-9]/g, '').slice(-9),
    role,
    quote: text.slice(0, 500),
  };
}

// Extracción de respaldo de los datos del perfil cuando el modelo no los entrega.
function extractFields(text, context) {
  const value = words(text);
  const asked = /carrera/i.test(
    (context.history ?? []).filter((item) => item.direction === 2).at(-1)?.text ?? '',
  );
  const fields = [];
  if (CAREER_CUE.test(value) || asked) {
    const career = CAREERS.find((name) => value.includes(words(name)));
    if (career) {
      const quote = new RegExp(career.split(' ')[0].slice(0, 5), 'i').exec(text);
      fields.push({
        field: 'career',
        value: career,
        quote: quote ? text.slice(quote.index, quote.index + career.length) : text,
      });
    }
  }
  const hours =
    /\b(\d+|una|dos|tres|cuatro|cinco|seis)\s+horas?(\s+(al|por)\s+(d[ií]a|semana)|\s+diarias)?/i.exec(
      text,
    );
  const days =
    /(fines?\s+de\s+semana|s[oó]lo\s+(los\s+)?(s[aá]bados|domingos)|(en|por)\s+las\s+(noches|ma[ñn]anas|tardes))/i.exec(
      text,
    );
  const time = hours ?? days;
  if (time) fields.push({ field: 'availability', value: time[0], quote: time[0] });
  const money =
    /(?:s\/\.?\s*(\d{2,4}(?:[.,]\d{1,2})?))|(\d{2,4})\s*(?:soles|lucas|mensuales|al mes)/i.exec(
      text,
    );
  if (money)
    fields.push({
      field: 'budget',
      value: String(Number((money[1] ?? money[2]).replace(',', '.'))),
      quote: money[0],
    });
  return fields;
}

// Descarta datos que el modelo inventa: una carrera sin pista en el texto, nombres de planes como
// carrera o un presupuesto sin moneda.
function keepField(item, text, context) {
  const value = words(text);
  const asked = /carrera/i.test(
    (context.history ?? []).filter((entry) => entry.direction === 2).at(-1)?.text ?? '',
  );
  if (item.field === 'career')
    return (
      (CAREER_CUE.test(value) || asked) &&
      !/unt|plan|explora|semestral|mensual|[0-9]/i.test(item.value)
    );
  if (item.field === 'budget')
    return (
      / (soles|sol|s|lucas|presupuesto|mensuales|al mes|mes) /.test(value) &&
      Number(item.value) >= 10
    );
  return true;
}

export function applyIntentRules(analysis, text, tariffs, context = {}) {
  analysis.fields = analysis.fields.filter((item) => keepField(item, text, context));
  for (const field of extractFields(text, context))
    if (!analysis.fields.some((item) => item.field === field.field)) analysis.fields.push(field);
  if (analysis.fields.length) analysis.understood = true;

  const contextPlan = context.requestedPlan?.plan ?? mentionedInHistory(context, tariffs);
  const value = words(text);
  if (isRetraction(text)) {
    analysis.retraction = true;
    analysis.level = 2;
    if (analysis.action === 'proposal' || analysis.action === 'trial') analysis.action = 'ask';
    analysis.understood = true;
  } else if (isPurchaseRequest(text)) {
    analysis.level = 3;
    analysis.action = 'proposal';
    analysis.tariffId =
      resolveTariff(text, tariffs) ??
      (contextPlan ? resolveTariff(`${contextPlan} ${text}`, tariffs) : null);
    analysis.understood = true;
  } else if (
    contextPlan &&
    / (si|ok|dale|claro|ya|quiero|prefiero|me quedo con|el|ese) /.test(value) &&
    / (mensual|semestral|semestre|al mes) /.test(value)
  ) {
    analysis.level = 3;
    analysis.action = 'proposal';
    analysis.tariffId = resolveTariff(`${contextPlan} ${text}`, tariffs);
    analysis.understood = true;
  } else if (isTrialRequest(text)) {
    analysis.action = 'trial';
    analysis.understood = true;
  } else if (isPaymentQuestion(text)) {
    analysis.level = 3;
    if (analysis.action !== 'proposal') analysis.action = 'catalog';
    analysis.understood = true;
  } else if (isObjection(text)) {
    if (['ask', 'handoff', 'trial'].includes(analysis.action) || !analysis.understood)
      analysis.action = 'catalog';
    analysis.level = Math.max(analysis.level, 2);
    analysis.understood = true;
  } else if (
    isQuestion(text) &&
    (retrieve(text, tariffs).length || mentionedPlans(text).length) &&
    ['ask', 'trial'].includes(analysis.action)
  ) {
    analysis.action = 'catalog';
    analysis.level = Math.max(analysis.level, 2);
    analysis.understood = true;
  }
  if (analysis.action === 'trial' && !TRIAL_WORDS.test(value)) analysis.action = 'catalog';
  if (needsGuardianText(text)) {
    analysis.needsGuardian = true;
    analysis.understood = true;
  }
  if (!analysis.guardian) {
    const guardian = extractGuardian(text);
    if (guardian) {
      analysis.guardian = guardian;
      analysis.understood = true;
    }
  }
  return analysis;
}

function mentionedInHistory(context, tariffs) {
  const names = [...new Set(tariffs.map((tariff) => tariff.plan))].sort(
    (a, b) => b.length - a.length,
  );
  for (const item of [...(context.history ?? [])].reverse()) {
    const found = names.find((name) => words(item.text).includes(words(name)));
    if (found) return found;
  }
  return null;
}
