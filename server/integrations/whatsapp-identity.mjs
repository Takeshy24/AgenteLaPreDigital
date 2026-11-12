export function isWhatsAppPhone(value) {
  return typeof value === 'string' && /^[1-9]\d{6,14}$/.test(value);
}

export function isWhatsAppUserId(value) {
  return typeof value === 'string' && /^[A-Z]{2}\.(?:ENT\.)?[A-Za-z0-9]{1,128}$/.test(value);
}

export function whatsappSender(message) {
  if (isWhatsAppPhone(message?.from)) return message.from;
  if (isWhatsAppUserId(message?.from_user_id)) return message.from_user_id;
  return null;
}

export function whatsappRecipient(value) {
  if (isWhatsAppUserId(value)) return { recipient: value };
  if (isWhatsAppPhone(value)) return { to: value };
  throw new Error('El destinatario de WhatsApp no tiene un teléfono o identificador válido.');
}
