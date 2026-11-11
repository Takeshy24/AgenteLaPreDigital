// Reglas de intención que complementan al modelo local: cuando el texto es explícito, el sistema
// no depende de que un modelo pequeño lo clasifique bien. El modelo propone; estas reglas deciden
// solo en los casos claros (sección 2.5, tabla 5).
const normalize = (text) =>
  String(text ?? '')
    .toLowerCase()
    .normalize('NFD')
    .split('')
    .filter((char) => char.charCodeAt(0) < 0x300 || char.charCodeAt(0) > 0x36f)
    .join('');

const PURCHASE =
  /(quiero|deseo|voy a|me gustaria|necesito|quisiera)[^.?!]*(pagar|contratar|comprar|adquirir|inscribirme|matricularme)/;
const TRIAL =
  /(quiero|deseo|me gustaria|quisiera|activar|probar)[^.?!]*(explora|prueba gratis|probar gratis|prueba gratuita)/;
const OBJECTION =
  /(muy caro|es caro|me parece caro|esta caro|caro|barat|economic|accesible|no me alcanza|muy costoso)/;
const GUARDIAN =
  /((mama|madre|papa|padre|apoderad[oa]|tutor|abuel[oa]|tio|tia)[^.?!]*(paga|pagara|decide|decidira))|no puedo decidir|no decido yo|quien paga es/;
const RELATION = [
  [/(mama|madre)/, 3],
  [/(papa|padre)/, 2],
  [/(apoderad|tutor)/, 4],
];

export function resolveTariff(text, tariffs) {
  const value = normalize(text);
  const names = [...new Set(tariffs.map((tariff) => tariff.plan))].sort(
    (a, b) => b.length - a.length,
  );
  const plan = names.find((name) => value.includes(normalize(name)));
  if (!plan) return null;
  const options = tariffs.filter((tariff) => tariff.plan === plan);
  const period = /semestr/.test(value)
    ? 'semestral'
    : /mensual|al mes|por mes/.test(value)
      ? 'mensual'
      : null;
  const chosen = period
    ? options.find((tariff) => normalize(tariff.modalidad) === period)
    : options.length === 1
      ? options[0]
      : null;
  return chosen?.idPlanTarifa ?? null;
}

export const isPurchaseRequest = (text) => PURCHASE.test(normalize(text));
export const isTrialRequest = (text) => TRIAL.test(normalize(text));
export const isObjection = (text) => OBJECTION.test(normalize(text));
export const needsGuardianText = (text) => GUARDIAN.test(normalize(text));

// Datos del responsable escritos en un mensaje: nombre (tras «se llama»), relación y teléfono +51.
export function extractGuardian(text) {
  const value = normalize(text);
  const role = RELATION.find(([pattern]) => pattern.test(value))?.[1];
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

export function applyIntentRules(analysis, text, tariffs) {
  if (isPurchaseRequest(text)) {
    analysis.level = 3;
    analysis.action = 'proposal';
    analysis.tariffId = resolveTariff(text, tariffs);
    analysis.understood = true;
  } else if (isTrialRequest(text)) {
    analysis.action = 'trial';
    analysis.understood = true;
  } else if (isObjection(text)) {
    if (['ask', 'handoff'].includes(analysis.action) || !analysis.understood)
      analysis.action = 'catalog';
    analysis.level = Math.max(analysis.level, 2);
    analysis.understood = true;
  }
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
