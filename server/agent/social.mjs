// Mensajes sociales: afecto, risas, asentimientos o solo emojis. No son una duda comercial, pero
// tampoco un mensaje que el agente "no entienda": se responden con calidez y se retoma el hilo.
const PHRASES = new Set([
  'te quiero',
  'te quiero mucho',
  'te amo',
  'te adoro',
  'que amable',
  'muy amable',
  'eres genial',
  'eres lo mejor',
  'eres muy amable',
  'ok',
  'okay',
  'okey',
  'vale',
  'listo',
  'perfecto',
  'genial',
  'excelente',
  'buenisimo',
  'chevere',
  'bacan',
  'de acuerdo',
  'entendido',
  'entiendo',
  'claro',
  'dale',
  'saludos',
  'bendiciones',
  'un abrazo',
  'gracias por todo',
  'xd',
  'lol',
]);

function words(text) {
  return String(text)
    .normalize('NFD')
    .toLowerCase()
    .split('')
    .filter((char) => char.charCodeAt(0) < 0x300 || char.charCodeAt(0) > 0x36f)
    .join('')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function isSocialMessage(text) {
  const value = String(text ?? '').trim();
  if (!value || value.length > 60) return false;
  const plain = words(value);
  if (!plain) return [...value].some((char) => char.codePointAt(0) > 0x2000);
  return PHRASES.has(plain) || /^(ja|je|ji|jo|js)+$/.test(plain.replace(/ /g, ''));
}

export const SOCIAL_ANALYSIS = {
  level: 1,
  retraction: false,
  action: 'ask',
  tariffId: null,
  fields: [],
  understood: true,
  needsGuardian: false,
  guardian: null,
  social: true,
};
