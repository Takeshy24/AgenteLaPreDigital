import nodemailer from 'nodemailer';
import { integrationConfig } from './config.mjs';

export function smtpConfigured() {
  const { user, password } = integrationConfig().smtp;
  return !!user && !!password;
}

function createTransport() {
  const { host, port, user, password } = integrationConfig().smtp;
  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass: password },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
  });
}

// Comprueba la conexión y las credenciales con el servidor SMTP sin enviar ningún mensaje.
export async function verifySmtp({ transport } = {}) {
  await (transport ?? createTransport()).verify();
  const { host, user } = integrationConfig().smtp;
  return { host, user };
}

// Un correo cuenta como entregado cuando el servidor SMTP lo acepta sin rechazar al destinatario.
export async function sendEmail({ to, subject, text, html }, { transport } = {}) {
  const { user, from } = integrationConfig().smtp;
  const info = await (transport ?? createTransport()).sendMail({
    from: from || user,
    to,
    subject,
    text,
    html,
  });
  if (info.rejected?.length) throw new Error('El servidor de correo rechazó al destinatario.');
  return { messageId: info.messageId };
}
