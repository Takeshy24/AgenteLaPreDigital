import { whatsappRecipient } from './whatsapp-identity.mjs';

export class WhatsAppError extends Error {
  constructor(message, uncertain = false) {
    super(message);
    this.uncertain = uncertain;
  }
}
export function whatsappClient({ token, phoneNumberId, apiVersion = 'v21.0' }, fetcher = fetch) {
  if (!token || !phoneNumberId)
    throw new WhatsAppError('Configura WHATSAPP_TOKEN y WHATSAPP_PHONE_NUMBER_ID en .env.');
  return {
    async send(payload, { timeout = 15000 } = {}) {
      let response;
      try {
        response = await fetcher(
          `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`,
          {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              messaging_product: 'whatsapp',
              recipient_type: 'individual',
              ...payload,
            }),
            signal: AbortSignal.timeout(timeout),
          },
        );
      } catch {
        throw new WhatsAppError('No se pudo confirmar la respuesta de WhatsApp.', true);
      }
      let body;
      try {
        body = await response.json();
      } catch {
        throw new WhatsAppError('Respuesta de WhatsApp ilegible.', true);
      }
      if (!response.ok || !body.messages?.[0]?.id)
        throw new WhatsAppError(
          `WhatsApp rechazó la solicitud (${body.error?.code ?? response.status}): ${body.error?.message ?? 'sin detalle'}`,
          response.status >= 500,
        );
      return body.messages[0].id;
    },
    sendText(to, text) {
      return this.send({
        ...whatsappRecipient(to),
        type: 'text',
        text: { body: text.slice(0, 4096), preview_url: false },
      });
    },
  };
}
