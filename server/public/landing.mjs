import { createHash } from 'node:crypto';
import { transaction } from '../db.mjs';
import { integrationConfig } from '../integrations/config.mjs';
import { sendEmail, smtpConfigured } from '../integrations/mailer.mjs';
import { hasActiveLink } from '../integrations/repository.mjs';
import { recordAutomaticEmail } from '../followup/service.mjs';
import { findContacts } from '../leads/repository.mjs';
import { saveLead } from '../leads/service.mjs';
import { telegramLink } from './intake.mjs';
import * as repository from './repository.mjs';

const LANDING_CAPTURE_CHANNEL = 1;
const REVIEW_PLAN = 'Sin plan elegido (landing)';

// Acepta 987654321 (se asume Perú) o un número internacional con +. Devuelve null si no es válido.
export function normalizePhone(value) {
  const digits = String(value).replace(/[\s\-().]/g, '');
  if (/^9\d{8}$/.test(digits)) return '+51' + digits;
  if (/^\+\d{8,15}$/.test(digits)) return digits;
  return null;
}

function botUrl() {
  const { username } = integrationConfig().telegram;
  return username ? `https://t.me/${username.replace(/^@/, '')}` : null;
}

function defaultSender() {
  return smtpConfigured() ? sendEmail : null;
}

export function telegramEmail(url) {
  return {
    subject: '¡Casi listo! Continúa en Telegram con LaPreDigital',
    text: [
      '¡Hola! 😊',
      '',
      'Gracias por tu interés en LaPreDigital. Para seguir conversando contigo por Telegram y ayudarte a elegir el plan que mejor se adapte a tu preparación, solo falta un paso:',
      '',
      'Abre este enlace y pulsa «Iniciar»:',
      url,
      '',
      'Por seguridad, el enlace funciona una sola vez y vence en 10 minutos. Si no fuiste tú quien lo pidió, no te preocupes: puedes ignorar este correo.',
      '',
      '¡Nos vemos en Telegram!',
      'El equipo de LaPreDigital',
    ].join('\n'),
    html: `<p>¡Hola! 😊</p>
<p>Gracias por tu interés en LaPreDigital. Para seguir conversando contigo por Telegram y ayudarte a elegir el plan que mejor se adapte a tu preparación, solo falta un paso:</p>
<p><a href="${url}" style="display:inline-block;padding:12px 20px;border-radius:8px;background:#255ee2;color:#ffffff;text-decoration:none;font-weight:bold">Continuar en Telegram</a></p>
<p>Abre el enlace y pulsa <b>Iniciar</b>.</p>
<p>Por seguridad, el enlace funciona una sola vez y vence en 10 minutos. Si no fuiste tú quien lo pidió, no te preocupes: puedes ignorar este correo.</p>
<p>¡Nos vemos en Telegram!<br>El equipo de LaPreDigital</p>`,
  };
}

// Un formulario público no puede vincularse a un correo ya registrado: no prueba que quien
// escribe sea su dueño y dejaría autorizaciones y LEADs a nombre de otra persona. Se guarda
// para que el personal comercial revise la identidad, una sola vez por correo y beneficiario.
async function saveIdentityReview(db, data, email) {
  const beneficiary = (data.role === 1 ? data.name : data.beneficiaryName)
    .trim()
    .replace(/\s+/g, ' ');
  const requestKey = createHash('sha256')
    .update(`${email}|${beneficiary.toUpperCase()}`)
    .digest('hex')
    .slice(0, 32);
  if (await repository.findRequest(db, requestKey)) return;
  const id = await repository.saveInquiry(db, {
    name: data.name,
    email,
    beneficiary,
    isStudent: data.role === 1,
    plan: REVIEW_PLAN,
    consent: data.channels.includes(2),
    phone: data.phone,
    role: data.role,
    requestKey,
  });
  await repository.linkInquiry(db, id, null, null, 'Revisar identidad');
}

// Enlace público al número de WhatsApp del negocio (no es un dato secreto: es el mismo para todos).
export function whatsappUrl() {
  const digits = String(process.env.WHATSAPP_PUBLIC_NUMBER || '').replace(/[^0-9]/g, '');
  const number = /^9[0-9]{8}$/.test(digits) ? '51' + digits : digits;
  if (!/^[0-9]{8,15}$/.test(number)) return null;
  return `https://wa.me/${number}?text=${encodeURIComponent('Hola, ya me registré en LaPreDigital')}`;
}

function receipt(telegramUrl) {
  const link = whatsappUrl();
  return {
    registered: true,
    ...(telegramUrl ? { telegramUrl } : {}),
    ...(link ? { whatsappUrl: link } : {}),
  };
}

// Para un correo ya registrado, el enlace de Telegram solo viaja por ese correo: así lo recibe su
// dueño y nadie más. Se envía una vez cada 10 minutos por contacto, mientras el enlace siga vigente.
async function prepareEmailedLink(db, contact, email, send) {
  if (!send) return { receipt: receipt(botUrl()) };
  if (await hasActiveLink(db, contact)) return { receipt: receipt(null) };
  const url = await telegramLink(db, contact, { consent: true });
  return { receipt: receipt(null), mail: url ? { to: email, url, contact } : null };
}

async function sendTelegramEmail(send, { to, url, contact }) {
  const message = telegramEmail(url);
  try {
    await send({ to, ...message });
  } catch (error) {
    console.error('No se pudo enviar el correo de verificación:', error.message);
    return;
  }
  try {
    await recordAutomaticEmail(contact, message.text);
  } catch (error) {
    console.error('No se pudo registrar el correo en la agenda:', error.message);
  }
}

// options.send: función que envía el correo. null = sin correo configurado.
export async function registerLanding(data, { send = defaultSender() } = {}) {
  if (data.website) return { registered: true };
  const email = data.email.trim().toLowerCase();
  const channels = [...new Set(data.channels)];
  const outcome = await transaction(async (db) => {
    const existing = (await findContacts(db, { email })).recordset[0];
    if (existing) {
      await saveIdentityReview(db, { ...data, channels }, email);
      if (!data.telegram) return { receipt: receipt(null) };
      return prepareEmailedLink(db, existing.id, email, send);
    }
    const lead = await saveLead(
      db,
      {
        name: data.name,
        email: data.email,
        phone: data.phone,
        role: data.role,
        channel: LANDING_CAPTURE_CHANNEL,
        communicationChannel: channels[0],
        consent: true,
        beneficiaryName: data.beneficiaryName,
      },
      { channels, reviewNameMatches: true },
    );
    const url = data.telegram ? await telegramLink(db, lead.contact, { consent: true }) : null;
    if (!url) return { receipt: receipt(null) };
    return {
      receipt: { ...receipt(url), ...(send ? { emailed: true } : {}) },
      mail: send ? { to: email, url, contact: lead.contact } : null,
    };
  });
  if (outcome.mail) await sendTelegramEmail(send, outcome.mail);
  return outcome.receipt;
}
