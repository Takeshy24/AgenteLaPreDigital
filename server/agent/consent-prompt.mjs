// Autorización de contacto obtenida en la conversación (F8, origen «Chat»). Responder a un mensaje
// no la requiere, pero escribir por iniciativa propia (agenda, personal comercial) sí. Si alguien
// escribe por WhatsApp o Telegram sin autorización registrada para ese canal, el agente le pregunta
// una sola vez, con botones, si quiere que le escriban por ahí para el seguimiento.
import { transaction, query } from '../db.mjs';
import { saveConsent } from '../consents/service.mjs';
import { createReply } from '../integrations/repository.mjs';
import { recordIncoming } from '../messages/service.mjs';
import { BusinessError } from '../shared/errors.mjs';
import { getParticipation } from '../shared/repository.mjs';
import { attachMarkup } from './repository.mjs';

const CHANNEL_NAMES = { 1: 'WhatsApp', 3: 'Telegram' };
export const CONSENT_YES = 'Sí, escríbanme';
export const CONSENT_NO = 'No, gracias';

export function parseConsent(data) {
  const match = /^ok:(\d+):([01])$/.exec(data ?? '');
  return match ? { participationId: Number(match[1]), granted: match[2] === '1' } : null;
}

async function hasChannelRecord(db, contact, channel) {
  return (
    (
      await query(
        db,
        'SELECT COUNT(*) n FROM dbo.AutorizacionContacto WHERE idContacto = @contact AND idCanal = @channel',
        { contact, channel },
      )
    ).recordset[0].n > 0
  );
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
