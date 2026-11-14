// Reglas de intención que complementan al modelo local: cuando el texto es explícito, el sistema
// no depende de que un modelo pequeño lo clasifique bien. El modelo propone; estas reglas deciden
// solo en los casos claros (sección 2.5, tabla 5; 2.2 derivación; F3 perfil; F4 responsable).
// Todas las búsquedas usan palabras completas: «caro» no coincide con «Carolina».
import { mentionedPlans, planMentions, retrieve } from './knowledge.mjs';

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
// Tipos de objeción de la tabla 3 (Cat_TipoObjecion): 1 precio, 2 confianza, 3 tiempo,
// 4 características y 5 alternativas.
const OBJECTION_TYPES = [
  [1, OBJECTION],
  [
    2,
    / (es seguro|es confiable|son confiables|confiable|confianza|funciona de verdad|es real|garantia|desconfio|me da miedo|no confio) /,
  ],
  [
    3,
    / (no tengo tiempo|no tiene tiempo|no tienen tiempo|tengo poco tiempo|no me da el tiempo|no me alcanza el tiempo|muy ocupado|muy ocupada|trabajo y estudio) /,
  ],
  [4, / (no tiene|no incluye|le falta|les falta|no trae) /],
  [
    5,
    / (otra academia|otras academias|otra plataforma|otras plataformas|academia presencial|ya estoy en una academia|en otra pre|otra pre) /,
  ],
];
const ACCEPTANCE =
  / (acepto|aceptamos|la acepto|lo acepto|acepto la propuesta|de acuerdo con la propuesta|me quedo con la propuesta) /;
const RELATIONS = [
  ['madre', 'mamá', 3, ['mama', 'mami', 'madre']],
  ['padre', 'papá', 2, ['papa', 'papi', 'padre', 'padres']],
  ['apoderado', 'apoderado', 4, ['apoderado', 'tutor']],
  ['apoderada', 'apoderada', 4, ['apoderada', 'tutora']],
  ...[
    'abuelo',
    'abuela',
    'hermano',
    'hermana',
    'esposo',
    'esposa',
    'pareja',
    'padrino',
    'madrina',
    'familiar',
    'responsable',
  ].map((key) => [key, key, 4, [key]]),
  ['tio', 'tío', 4, ['tio']],
  ['tia', 'tía', 4, ['tia']],
  ['primo', 'primo', 4, ['primo']],
  ['prima', 'prima', 4, ['prima']],
  ['conyuge', 'cónyuge', 4, ['conyuge']],
];
const RELATION_BY_WORD = new Map(
  RELATIONS.flatMap(([key, label, role, aliases]) =>
    aliases.map((alias) => [alias, { key, label, role }]),
  ),
);
const RELATIVE = `(${[...RELATION_BY_WORD.keys()].join('|')})`;
export function guardianRelation(text) {
  const found = [...words(text).matchAll(new RegExp(`\\b${RELATIVE}\\b`, 'g'))].map((match) =>
    RELATION_BY_WORD.get(match[0]),
  );
  const specific = found.filter((relation) => !['familiar', 'responsable'].includes(relation.key));
  return (specific.length ? specific : found).at(-1) ?? null;
}
const GUARDIAN = new RegExp(
  ` (${RELATIVE} ([a-z ]* )?(paga|pagan|pagara|decide|deciden|decidira)|(paga|pagan|decide|deciden) ([a-z ]* )?${RELATIVE}|no puedo decidir|no decido yo|depende de mis padres|tengo que consultarlo|consultarlo con) `,
);
const INVITATION =
  / (invitacion|invitaciones|invitar|invitarle|invitarla|invitarlo|invitarles|invita|invitale|inviten) /;
const INVITATION_REQUEST =
  / (quiero|quisiera|deseo|necesito|puedes|pueden|podrias|podrian|me gustaria|prepara|preparen|preparame|generame|pasame|mandame|enviame|enviale|dame|me das|invita|invitale|inviten) /;
const CONTACT_DENIAL =
  / (no|ya no) (le |les |la |lo )?(llamen|llames|molesten|molestes|quiero|quisiera|necesito|deseo|puedes|pueden|hables|hablen|contactes|contacten|escribas|escriban|envies|envien|mandes|manden|le escribas|le envies|le mandes|lo contactes|la contactes) /;
export function declinesFamilyContact(text) {
  const value = words(text);
  return (
    CONTACT_DENIAL.test(value) &&
    (new RegExp(` ${RELATIVE} `).test(value) || INVITATION.test(value))
  );
}
function requestsInvitation(text) {
  return String(text)
    .split(/[.,;!?¿\n]+/)
    .some((part) => {
      const value = words(part);
      return (
        INVITATION.test(value) &&
        INVITATION_REQUEST.test(value) &&
        !/ (no|ya no) (quiero|quisiera|deseo|necesito|invites|inviten|le envies|le envien) /.test(
          value,
        )
      );
    });
}
export function requestsFamilyContact(text) {
  const value = words(text);
  const family = new RegExp(` ${RELATIVE} `).test(value);
  const action =
    / (hablar|habla|hables|hablen|contactar|contacta|contactalo|contactala|contactes|contacten|escribir|escribe|escribele|escribeles|escribas|escriban|enviar|envia|enviale|enviales|envies|envien|mandar|manda|mandale|mandales|mandes|manden) /;
  const request =
    / (quiero|quisiera|necesito|deseo|puedes|pueden|podrias|podrian|me gustaria|por favor|habla|hablen|contacta|contactalo|contactala|contacten|escribe|escribele|escribeles|escriban|envia|enviale|enviales|envien|manda|mandale|mandales|manden) /;
  return family && action.test(value) && request.test(value) && !CONTACT_DENIAL.test(value);
}
function familyPaymentInformation(text) {
  return / (pregunta|pregunto|quiere saber|quiere conocer|como se paga|puede pagar|podria pagar) /.test(
    words(text),
  );
}
function deniesFamilyPayment(text) {
  return / (no|nunca|tampoco) (se )?(va a )?(paga|pagara|pagaran|pagaria|pague|paguen|hara cargo|hace cargo|encargara|encarga|cubrira|cubre|asumira|asume|manejara|maneja|gestionara|gestiona) /.test(
    words(text),
  );
}
export function hasGuardianPaymentContext(text) {
  const value = words(text);
  const payment =
    / (pago|pagos|pagar|pague|paguen|cuota|cuotas|costo|costos|gasto|gastos|mensualidad|financiamiento) /;
  return (
    !!guardianRelation(text) &&
    payment.test(value) &&
    !declinesFamilyContact(text) &&
    !familyPaymentInformation(text) &&
    !deniesFamilyPayment(text)
  );
}
function assignsFamilyPayment(text) {
  const value = words(text);
  const responsibility =
    / (maneja|maneje|manejara|gestiona|gestione|gestionara|se encarga|se encargue|se encargara|encargarse|se ocupa|se ocupe|se ocupara|hacerse cargo|se hace cargo|se haga cargo|se hara cargo|asume|asuma|asumira|cubre|cubra|cubrira|cubrir|hara|haga|debe hacer|debe de hacer|va a hacer|realiza|realice|realizara|pague|paguen|responsable) /;
  return hasGuardianPaymentContext(text) && responsibility.test(value);
}
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

// Cursos del examen de admisión que se reconocen en un mensaje libre (tabla 3: cursos difíciles).
const COURSES = [
  ['Razonamiento matemático', / razonamiento matematico /],
  ['Razonamiento verbal', / razonamiento verbal /],
  ['Matemática', / (matematica|matematicas|mate) /],
  ['Aritmética', / aritmetica /],
  ['Álgebra', / algebra /],
  ['Geometría', / geometria /],
  ['Trigonometría', / trigonometria /],
  ['Física', / fisica /],
  ['Química', / quimica /],
  ['Biología', / biologia /],
  ['Lenguaje', / lenguaje /],
  ['Literatura', / literatura /],
  ['Historia', / historia /],
  ['Geografía', / geografia /],
];
const COURSE_CUE =
  / (me cuesta|me cuestan|dificil|dificiles|me va mal|flojo|floja|no entiendo|complicado|complicada|reforzar|debil|debiles) /;
const APPLICATION_CUE =
  / (postule|postulamos|postulo antes|di el examen|rendi el examen|primera vez|mi primera postulacion|nunca postule|ya postule|postulaciones) /;

const PLAN_INFORMATION =
  / (saber|conocer|informacion|incluye|incluyen|trae|ofrece|beneficios|contiene|cuesta|cuanto|precio|precios|comparar|compara|diferencia|diferencias) /;
const PLAN_SELECTION = / (quiero|quisiera|deseo|prefiero|me quedo con|cambiame|cambiar a) /;
const PERIOD_SELECTION = / (si|ok|dale|claro|ya|quiero|prefiero|me quedo con|el|ese) /;

function periodsIn(text) {
  const value = words(text);
  return [
    / (mensual|al mes|por mes) /.test(value) && 'mensual',
    / (semestral|semestre) /.test(value) && 'semestral',
  ].filter(Boolean);
}

function singlePlan(text) {
  const plans = mentionedPlans(text).filter((name) => name !== 'Explora UNT');
  return plans.length === 1 ? plans[0] : null;
}

function previousChoice(context) {
  const history = context.history ?? [];
  let periods = [];
  for (const item of [...history].reverse().filter((entry) => entry.direction === 1)) {
    if (planMentions(item.text).length)
      return {
        plan: singlePlan(item.text),
        periods: periods.length ? periods : periodsIn(item.text),
      };
    const value = words(item.text);
    if (!periods.length && PERIOD_SELECTION.test(value) && !PLAN_INFORMATION.test(value))
      periods = periodsIn(item.text);
  }
  if (context.requestedPlan?.plan)
    return {
      plan: context.requestedPlan.plan,
      periods: periods.length ? periods : periodsIn(context.requestedPlan.period),
    };
  const last = history.filter((item) => item.direction === 2).at(-1)?.text;
  return { plan: singlePlan(last), periods: periods.length ? periods : periodsIn(last) };
}

export function resolveTariff(text, tariffs, context = {}) {
  const previous = previousChoice(context);
  const plan = planMentions(text).length ? singlePlan(text) : previous.plan;
  if (!plan) return null;
  const currentPeriods = periodsIn(text);
  const periods = currentPeriods.length
    ? currentPeriods
    : previous.plan === plan
      ? previous.periods
      : [];
  if (periods.length > 1) return null;
  const options = tariffs.filter((tariff) => tariff.plan === plan);
  const period = periods[0];
  const chosen = period
    ? options.find((tariff) => words(tariff.modalidad).trim() === period)
    : options.length === 1
      ? options[0]
      : null;
  return chosen?.idPlanTarifa ?? null;
}

// «El que me recomendaste», «el recomendado», «ese mismo»: se refiere al plan recomendado antes.
export const refersToRecommendation = (text) => {
  const value = words(text);
  return (
    / (el|la|lo) que (me |nos |le )?(recomendaste|recomendo|recomiendas|sugeriste|sugirio|propusiste|dijiste|mencionaste) /.test(
      value,
    ) ||
    / (el|la|lo) (recomendado|recomendada|sugerido|sugerida) /.test(value) ||
    / (ese|esa|este|esta) (plan|opcion|mismo|misma|modalidad) /.test(value) ||
    / (el|la) (mismo|misma) /.test(value) ||
    /^ (quiero |me quedo con |dame |prefiero )?(ese|esa|ese mismo|esa misma|el mismo|ese plan|esa opcion)( por favor| porfa)? $/.test(
      value,
    )
  );
};
export const isPurchaseRequest = (text) => PURCHASE.test(words(text)) && !NEGATED.test(words(text));
export const isTrialRequest = (text) => TRIAL.test(words(text));
export const isObjection = (text) => OBJECTION.test(words(text));
export const objectionType = (text) =>
  OBJECTION_TYPES.find(([, pattern]) => pattern.test(words(text)))?.[0] ?? null;
export const isAcceptance = (text) =>
  ACCEPTANCE.test(words(text)) && !/ no (la |lo )?acept/.test(words(text));

// Plan mencionado con una modalidad que no existe (F5: Ruta UNT solo mensual).
export function unavailableOption(text, tariffs) {
  const value = words(text);
  const period = / (semestral|semestre) /.test(value)
    ? 'Semestral'
    : / (mensual|al mes|por mes) /.test(value)
      ? 'Mensual'
      : null;
  if (!period) return null;
  const plan = mentionedPlans(text).find((name) => name !== 'Explora UNT');
  if (!plan || tariffs.some((tariff) => tariff.plan === plan && tariff.modalidad === period))
    return null;
  const options = tariffs
    .filter((tariff) => tariff.plan === plan)
    .map((tariff) => tariff.modalidad.toLowerCase());
  return options.length
    ? `${plan} no tiene modalidad ${period.toLowerCase()}; solo se contrata ${options.join(' o ')}.`
    : `${plan} no tiene una tarifa vigente.`;
}
export const isPaymentQuestion = (text) => PAYMENT_ASK.test(words(text));
export const isRetraction = (text) => RETRACTION.test(words(text));
export const needsGuardianText = (text) =>
  !declinesFamilyContact(text) &&
  (requestsInvitation(text) ||
    requestsFamilyContact(text) ||
    (!familyPaymentInformation(text) &&
      !deniesFamilyPayment(text) &&
      (GUARDIAN.test(words(text)) || assignsFamilyPayment(text))));
export const isQuestion = (text) => /[?¿]/.test(text) || QUESTION_START.test(words(text));

// Datos del responsable económico (F4) en texto libre: relación, nombre y celular. Cada mensaje puede
// traer solo una parte; guardianFrom une las partes de varios mensajes.
// Cónyuge o pareja del contacto no implica ser madre o padre del beneficiario: se invita como otro responsable.
const RELATION_WORD =
  '(?:mam[aá]|mami|madre|pap[aá]|papi|padre|apoderad[oa]|tutora?|t[ií][oa]|abuel[oa]|herman[oa]|padrino|madrina|prim[oa]|espos[oa]|pareja|c[oó]nyuge)';
const NAME_STOP = new Set([
  'y',
  'su',
  'sus',
  'cel',
  'celular',
  'numero',
  'número',
  'telefono',
  'teléfono',
  'whatsapp',
  'es',
  'el',
  'la',
  'que',
  'quien',
  'quién',
  'con',
  'al',
  'paga',
  'pagara',
  'pagará',
  'decide',
  'me',
  'mi',
  'nro',
  'tel',
  'fono',
  'correo',
  'quiero',
  'quisiera',
  'necesito',
  'para',
  'por',
  'sobre',
  'habla',
  'hablar',
  'contacta',
  'contactar',
  'ella',
  'él',
  'el',
]);
const CONNECTORS = new Set(['de', 'del', 'los', 'las']);
const titleCase = (value) =>
  value
    .split(' ')
    .map((word) => (CONNECTORS.has(word) ? word : word[0].toUpperCase() + word.slice(1)))
    .join(' ');
function nameAfter(text, index) {
  const tokens = text.slice(index).split(/\s+/);
  const name = [];
  for (const raw of tokens) {
    const token = raw.replace(/[.,;:!?()]+$/g, '');
    const clean = token.toLocaleLowerCase('es');
    if (!/^[a-záéíóúñü]+$/i.test(token) || NAME_STOP.has(clean)) break;
    name.push(clean);
    if (/[.,;:!?]$/.test(raw) || name.length === 6) break;
  }
  while (name.length && CONNECTORS.has(name.at(-1))) name.pop();
  return name.filter((word) => !CONNECTORS.has(word)).length >= 2
    ? titleCase(name.join(' '))
    : null;
}
export function guardianParts(text, { nameExpected = false } = {}) {
  if (declinesFamilyContact(text)) return { name: null, phone: null, role: null };
  const role = guardianRelation(text)?.role ?? null;
  const phoneMatch = /(?:\+\s?\d{1,3}[\s-]*)?(?:\d[\s-]*){8,11}\d/.exec(text);
  let phone = null;
  if (phoneMatch) {
    const digits = phoneMatch[0].replace(/[^0-9]/g, '');
    if (phoneMatch[0].trim().startsWith('+')) phone = '+' + digits;
    else if (/^9\d{8}$/.test(digits)) phone = '+51' + digits;
    else if (/^519\d{8}$/.test(digits)) phone = '+' + digits;
  }
  let name = null;
  const called = /(?:se\s+llama|su\s+nombre\s+es|nombre\s*:|llamad[oa])\s+/i.exec(text);
  if (called) name = nameAfter(text, called.index + called[0].length);
  if (!name) {
    const relation = new RegExp(`\\b${RELATION_WORD}\\s+(?=[A-ZÁÉÍÓÚÑ])`, 'u').exec(text);
    if (relation) name = nameAfter(text, relation.index + relation[0].length);
  }
  if (!name && nameExpected && !needsGuardianText(text)) name = nameAfter(text, 0);
  return { name, phone, role };
}
export function guardianFrom(texts, options = {}) {
  const merged = { name: null, phone: null, role: null };
  let relation = null;
  for (const text of texts) {
    const current = guardianRelation(text);
    if (current && relation && current.key !== relation.key) {
      merged.name = null;
      merged.phone = null;
    }
    if (current) relation = current;
    const parts = guardianParts(text, options);
    for (const key of Object.keys(merged)) if (parts[key]) merged[key] = parts[key];
  }
  return merged;
}
export const guardianComplete = (parts) => !!(parts.name && parts.phone && parts.role);
export function extractGuardian(text) {
  const parts = guardianParts(text);
  return guardianComplete(parts) ? { ...parts, quote: text.slice(0, 500) } : null;
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
  const lastQuestion =
    (context.history ?? []).filter((item) => item.direction === 2).at(-1)?.text ?? '';
  if (COURSE_CUE.test(value) || /cursos/i.test(lastQuestion)) {
    const courses = COURSES.filter(([, pattern]) => pattern.test(value)).map(([name]) => name);
    if (courses.length)
      fields.push({ field: 'courses', value: courses.join(', '), quote: text.slice(0, 200) });
  }
  if (
    APPLICATION_CUE.test(value) ||
    (/postulaste/i.test(lastQuestion) && / (si|no) /.test(value))
  ) {
    const first =
      / (primera vez|nunca postule|no) /.test(value) && !/ (ya postule|postule) /.test(value);
    const times = / (una|1|dos|2|tres|3|varias) (veces|vez) /.exec(value)?.[1];
    fields.push({
      field: 'applications',
      value: first
        ? 'Primera postulación (no postuló antes)'
        : times
          ? / (una|1) /.test(` ${times} `)
            ? 'Postuló una vez'
            : `Postuló ${{ 2: 'dos', 3: 'tres' }[times] ?? times} veces`
          : text.trim().slice(0, 200),
      quote: text.slice(0, 200),
    });
  }
  const score =
    /(?:saqu[eé]|obtuve|puntaje(?: de)?|tuve)\s+(\d{2,4}(?:[.,]\d{1,2})?)\s*(?:puntos)?/i.exec(
      text,
    );
  if (score)
    fields.push({
      field: 'score',
      value: String(Number(score[1].replace(',', '.'))),
      quote: score[0],
    });
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
  if (declinesFamilyContact(text)) {
    analysis.needsGuardian = false;
    analysis.guardian = null;
    analysis.action = 'ask';
    analysis.tariffId = null;
    analysis.understood = true;
    return analysis;
  }

  const value = words(text);
  const selectsPlan =
    mentionedPlans(text).some((name) => name !== 'Explora UNT') &&
    PLAN_SELECTION.test(value) &&
    !PLAN_INFORMATION.test(value);
  const selectsPeriod =
    !planMentions(text).length &&
    previousChoice(context).plan &&
    PERIOD_SELECTION.test(value) &&
    periodsIn(text).length &&
    !PLAN_INFORMATION.test(value);
  if (isRetraction(text) && !selectsPlan) {
    analysis.retraction = true;
    analysis.level = 2;
    if (analysis.action === 'proposal' || analysis.action === 'trial') analysis.action = 'ask';
    analysis.understood = true;
  } else if (isPurchaseRequest(text) || selectsPlan || selectsPeriod) {
    analysis.level = 3;
    analysis.action = 'proposal';
    analysis.retraction = false;
    analysis.understood = true;
  } else if (isTrialRequest(text)) {
    analysis.action = 'trial';
    analysis.understood = true;
  } else if (isPaymentQuestion(text)) {
    analysis.level = 3;
    if (analysis.action !== 'proposal') analysis.action = 'catalog';
    analysis.understood = true;
  } else if (isAcceptance(text)) {
    analysis.accepts = true;
    analysis.level = 3;
    analysis.understood = true;
  } else if (objectionType(text)) {
    if (['ask', 'handoff', 'trial'].includes(analysis.action) || !analysis.understood)
      analysis.action = 'catalog';
    analysis.level = Math.max(analysis.level, 2);
    analysis.understood = true;
  } else if (
    (isQuestion(text) || (mentionedPlans(text).length && PLAN_INFORMATION.test(value))) &&
    (retrieve(text, tariffs, 3, context.documents).length || mentionedPlans(text).length) &&
    ['ask', 'trial'].includes(analysis.action)
  ) {
    analysis.action = 'catalog';
    analysis.level = Math.max(analysis.level, 2);
    analysis.understood = true;
  }
  if (analysis.action === 'trial' && !TRIAL_WORDS.test(value)) analysis.action = 'catalog';
  if (!analysis.retraction && !analysis.accepts) analysis.objection = objectionType(text);
  if (familyPaymentInformation(text) || deniesFamilyPayment(text)) {
    if (!requestsFamilyContact(text) && !requestsInvitation(text)) {
      analysis.needsGuardian = false;
      analysis.guardian = null;
    }
  }
  if (needsGuardianText(text) || (analysis.needsGuardian && hasGuardianPaymentContext(text))) {
    analysis.needsGuardian = true;
    analysis.understood = true;
    analysis.action = 'ask';
    analysis.tariffId = null;
  }
  if (!analysis.guardian) {
    const guardian = extractGuardian(text);
    if (guardian) {
      analysis.guardian = guardian;
      analysis.understood = true;
    }
  }
  if (analysis.action === 'proposal') analysis.tariffId = resolveTariff(text, tariffs, context);
  return analysis;
}
