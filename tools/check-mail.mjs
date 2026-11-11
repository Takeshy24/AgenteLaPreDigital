import 'dotenv/config';
import { sendEmail, smtpConfigured, verifySmtp } from '../server/integrations/mailer.mjs';

const toIndex = process.argv.indexOf('--to');
const recipient = toIndex === -1 ? '' : (process.argv[toIndex + 1] ?? '');

if (!smtpConfigured()) {
  console.error('Falta SMTP_USER o SMTP_PASSWORD en .env. No se probó nada.');
  process.exit(1);
}
try {
  const { host, user } = await verifySmtp();
  console.log(
    `Conexión y credenciales correctas con ${host} como ${user}. No se envió ningún mensaje.`,
  );
  if (toIndex !== -1) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
      console.error('Indica un correo válido después de --to.');
      process.exit(1);
    }
    const { messageId } = await sendEmail({
      to: recipient,
      subject: 'Prueba de correo de LaPreDigital',
      text: 'Si lees esto, el envío por SMTP funciona. No hace falta responder.',
    });
    console.log(`Mensaje de prueba aceptado por el servidor para ${recipient} (${messageId}).`);
  }
} catch (error) {
  console.error('No se pudo usar el servidor de correo:', error.message);
  process.exit(1);
}
