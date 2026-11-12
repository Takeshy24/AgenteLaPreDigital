// Invitación directa al responsable económico que ya es contacto (F4): si el número que dio el
// estudiante pertenece a un único contacto con un canal autorizado y utilizable, el sistema le envía
// la invitación por ese canal. Se usa el primer canal que autorizó, como en la agenda (tabla 7).
import { query } from '../db.mjs';
import { listChannels } from '../followup/repository.mjs';
import { integrationConfig } from '../integrations/config.mjs';
import { sendEmail, smtpConfigured } from '../integrations/mailer.mjs';
import { insideServiceWindow } from '../integrations/repository.mjs';
import { insert } from '../shared/repository.mjs';

export const CHANNEL_NAMES = { 1: 'WhatsApp', 2: 'correo', 3: 'Telegram' };
const defaultMailer = () => (smtpConfigured() ? sendEmail : null);

export async function findDirectTarget(db, phone, studentContact) {
  const found = (
    await query(
      db,
      'SELECT idContacto id, nombreCompleto name, correo email FROM dbo.Contacto WHERE telefono=@phone',
      { phone },
    )
  ).recordset;
  return found.length === 1 && found[0].id !== studentContact ? found[0] : null;
}

// Canal utilizable ahora: Telegram si inició el bot, WhatsApp solo dentro de las 24 horas (fuera
// de ellas se exige una plantilla aprobada, que no admite el enlace) y correo si hay SMTP.
async function usable(db, channel, contact, mailer) {
  const config = integrationConfig();
  if (channel.idCanal === 3) return config.telegram.enabled && !!config.telegram.token;
  if (channel.idCanal === 1)
    return config.whatsapp.enabled && (await insideServiceWindow(db, contact));
  return !!mailer && !!channel.correo;
}

export async function deliverDirectInvitation(
  db,
  { target, text, email, replyTo },
  { mailer = defaultMailer() } = {},
) {
  for (const channel of await listChannels(db, target.id)) {
    if (!(await usable(db, channel, target.id, mailer))) continue;
    if (channel.idCanal === 2) {
      try {
        await mailer({ to: channel.correo, ...email });
      } catch {
        continue;
      }
    }
    await insert(
      db,
      `INSERT dbo.Mensaje (idContacto, idDireccion, idCanal, idOrigenMensaje, idAutorizacionAlEnvio,
    idMensajeRespondido, textoMensaje, idEstadoEntrega, fechaEntrega, esAutomatico)
  VALUES (@contact, 2, @channel, 2, @authorization, @replyTo, @text, @state,
    CASE WHEN @state = 2 THEN DATEADD(HOUR, -5, SYSUTCDATETIME()) END, 0)`,
      {
        contact: target.id,
        channel: channel.idCanal,
        authorization: channel.idAutorizacion,
        replyTo,
        text,
        state: channel.idCanal === 2 ? 2 : 1,
      },
    );
    return { channel: channel.idCanal };
  }
  return null;
}

// Contacto al que se envió directamente la invitación de este código, si lo hubo.
export async function directInvitee(db, code) {
  return (
    await query(
      db,
      `SELECT TOP 1 c.idContacto id, c.nombreCompleto name, c.correo email, c.telefono phone, m.idCanal channel
    FROM dbo.Mensaje m JOIN dbo.Contacto c ON c.idContacto = m.idContacto
    WHERE m.idDireccion = 2 AND m.idLeadCaso IS NULL AND m.textoMensaje LIKE @pattern
    ORDER BY m.idMensaje DESC`,
      { pattern: `%/invitacion/${code}%` },
    )
  ).recordset[0];
}
