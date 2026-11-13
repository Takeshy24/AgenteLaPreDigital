// Autorización de contacto obtenida en la conversación (F8, origen «Chat»). Responder a un mensaje
// no la requiere, pero escribir por iniciativa propia (agenda, personal comercial) sí. Si alguien
// escribe por WhatsApp o Telegram sin autorización registrada para ese canal, el agente le pregunta
// una sola vez, con botones, si quiere que le escriban por ahí para el seguimiento.
import { transaction, query } from '../db.mjs';
import { saveConsent } from '../consents/service.mjs';
import { hasChannelRecord } from '../consents/repository.mjs';
import { createReply } from '../integrations/repository.mjs';
import { recordIncoming } from '../messages/service.mjs';
import { BusinessError } from '../shared/errors.mjs';
import { getParticipation } from '../shared/repository.mjs';
import { attachMarkup } from './repository.mjs';
import { words } from './intents.mjs';

const CHANNEL_NAMES = { 1: 'WhatsApp', 3: 'Telegram' };
export const CONSENT_YES = 'Sí, escríbanme';
export const CONSENT_NO = 'No, gracias';

// Se atiende antes del modelo y de elegir beneficiario: el permiso pertenece al contacto.
// «¿Cómo me doy de baja?» o «¿Puedo pedir que no me escriban?» son consultas: el agente explica cómo
// hacerlo y no revoca nada.
const HOW_TO_QUESTION =
  /^ (?:como|de que (?:manera|forma)|que (?:debo|tengo que|hay que) hacer|que hago|puedo|se puede|donde) /;

export function isNoContactRequest(text) {
  return !HOW_TO_QUESTION.test(words(text)) && asksToStopContact(text);
}

// Pregunta por cómo dejar de recibir mensajes; se responde con UNSUBSCRIBE_HELP.
export function isUnsubscribeQuestion(text) {
  const value = words(text);
  return (
    HOW_TO_QUESTION.test(value) &&
    (asksToStopContact(text) || / (?:dejo|dejar|deje) de recibir /.test(value))
  );
}
export const UNSUBSCRIBE_HELP =
  'Puedes pedirlo cuando quieras: escribe «no me escriban más» y dejaremos de escribirte por todos los canales, o indica uno, por ejemplo «no me escriban por WhatsApp». Si cambias de opinión, escribe «quiero volver a recibir mensajes».';

function asksToStopContact(text) {
  const value = words(text).replace(
    / no (?:quiero|deseo) (?:que (?:dejen|dejes|deje)|dejar) de (?:escrib|contact|llam)[a-z]* /g,
    ' ',
  );
  return [
    / no (?:(?:quiero|deseo|autorizo|permito) que )?(?:me|nos) (?:(?:vuelvan|vuelvas|vuelva) a |sigan |sigas |siga )?(?:escrib|contact|llam)[a-z]* /,
    / (?:dejen|deja|deje) de (?:escrib|contact|llam)[a-z]* /,
    / no (?:quiero|deseo) (?:volver a )?recibir (?:mas )?(?:mensajes|correos|llamadas|notificaciones|publicidad|informacion|nada) /,
    / no (?:(?:quiero|deseo) que )?(?:me|nos) (?:manden|mandes|envien|envies|escriban) (?:mas )?(?:mensajes|correos|publicidad|informacion|nada) /,
    / (?:retiro|revoco|cancelo|anulo|quito) (?:mi |el |la )?(?:autorizacion|consentimiento|permiso) /,
    / (?:darme|dar|me doy|doy|denme|den) de baja /,
    / (?:desuscribirme|desuscribir|desuscribanme|desuscribeme|desuscribo) /,
    /^ (?:por favor )?stop $/,
  ].some((pattern) => pattern.test(value));
}

const CHANNEL_WORDS = [
  [1, / (?:whatsapp|wsp|wasap|whats) /],
  [2, / (?:correo|correos|email|mail|gmail) /],
  [3, / telegram /],
];
const mentionedChannels = (value) =>
  CHANNEL_WORDS.filter(([, pattern]) => pattern.test(value)).map(([channel]) => channel);

// Canales que la persona pide dejar de usar. «Ya no me escriban por WhatsApp, solo por correo»
// revoca WhatsApp y conserva el correo; si no nombra ningún canal, se revocan todos los que no
// pide conservar.
export function noContactChannels(text) {
  const [refused, ...rest] = words(text).split(/ (?:solo|solamente|unicamente|pero|mejor) /);
  const kept = mentionedChannels(` ${rest.join(' ')} `);
  const named = mentionedChannels(` ${refused} `).filter((channel) => !kept.includes(channel));
  if (named.length) return named;
  return [1, 2, 3].filter((channel) => !kept.includes(channel));
}

// Pedido expreso de volver a recibir mensajes por el canal en que escribe. Se evalúa después de
// isNoContactRequest, que atiende «no quiero volver a recibir mensajes».
export function isResumeContactRequest(text) {
  const value = words(text);
  if (/ no (?:quiero|deseo|pueden|puedes) (?:volver|que) /.test(value)) return false;
  return [
    / (?:quiero|deseo|quisiera) volver a recibir /,
    / (?:pueden|podrian|puedes|vuelvan a|vuelve a) (?:volver a )?(?:escribirme|contactarme|escribirnos) /,
    / (?:si |ya )?(?:pueden|puedes) (?:volver a )?(?:escribirme|contactarme|mandarme mensajes) /,
    / (?:autorizo|acepto) (?:que me escriban|que me contacten|recibir mensajes|el seguimiento) /,
    / (?:sigan|siga) (?:escribiendome|contactandome) /,
  ].some((pattern) => pattern.test(value));
}

export const channelList = (channels) => {
  const names = channels.map((channel) => ({ 1: 'WhatsApp', 2: 'correo', 3: 'Telegram' })[channel]);
  return names.length > 1 ? `${names.slice(0, -1).join(', ')} y ${names.at(-1)}` : names[0];
};
export const RESUME_HINT = 'Si cambias de opinión, escribe «quiero volver a recibir mensajes».';

export function parseConsent(data) {
  const match = /^ok:(\d+):([01])$/.exec(data ?? '');
  return match ? { participationId: Number(match[1]), granted: match[2] === '1' } : null;
}

async function wasAsked(db, contact, channel) {
  return (
    (
      await query(
        db,
        `SELECT
  COUNT(*) n
FROM
  dbo.Mensaje m
  JOIN dbo.App_Dispatch d ON d.idMensaje = m.idMensaje
WHERE
  m.idContacto = @contact
  AND m.idCanal = @channel
  AND d.markup LIKE N'%"consent_prompt":true%'`,
        { contact, channel },
      )
    ).recordset[0].n > 0
  );
}

// Pregunta solo si el canal nunca tuvo un registro de autorización (otorgada, revocada o denegada)
// y si no se preguntó antes por ese canal.
export async function askChannelConsent(db, participation, channel, replyTo) {
  if (!CHANNEL_NAMES[channel] || participation.idEstadoCaso !== 1) return false;
  if (await hasChannelRecord(db, participation.idContacto, channel)) return false;
  if (await wasAsked(db, participation.idContacto, channel)) return false;
  const reply = await createReply(
    db,
    participation,
    `¿Te parece bien que te escribamos por ${CHANNEL_NAMES[channel]} para acompañarte en tu preparación? Puedes decir «no me escriban» cuando quieras.`,
    replyTo,
  );
  const id = participation.idLeadCaso;
  await attachMarkup(db, reply, {
    consent_prompt: true,
    inline: true,
    inline_keyboard: [
      [{ text: CONSENT_YES, callback_data: `ok:${id}:1` }],
      [{ text: CONSENT_NO, callback_data: `ok:${id}:0` }],
    ],
  });
  return true;
}

// Registra la respuesta como mensaje entrante (evidencia) y como autorización otorgada o denegada.
export async function answerConsent(participationId, { granted, channel, text }) {
  return transaction(async (db) => {
    const participation = await getParticipation(db, participationId);
    if (participation.idEstadoCaso !== 1) throw new BusinessError('El caso está cerrado.');
    if (await hasChannelRecord(db, participation.idContacto, channel)) return { already: true };
    const incoming = await recordIncoming(
      participationId,
      { text: text ?? (granted ? CONSENT_YES : CONSENT_NO), channel, level: 1 },
      { source: 2 },
    );
    if (granted) await saveConsent(participationId, { channel, granted: true, version: 'chat-v1' });
    else
      await query(
        db,
        `INSERT dbo.AutorizacionContacto (idContacto, idCanal, idEstadoAutorizacion, idOrigenAutorizacion, versionTexto)
         VALUES (@contact, @channel, 3, 3, N'chat-v1')`,
        { contact: participation.idContacto, channel },
      );
    await createReply(
      db,
      await getParticipation(db, participationId),
      granted
        ? `¡Gracias! Te escribiremos por ${CHANNEL_NAMES[channel]} para acompañarte. 😊`
        : 'Entendido. Solo te responderé cuando tú me escribas. 😊',
      incoming.id,
    );
    return { granted, messageId: incoming.id };
  });
}
