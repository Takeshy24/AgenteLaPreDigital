export class TelegramError extends Error {
  constructor(message, uncertain = false) {
    super(message);
    this.uncertain = uncertain;
  }
}
export function telegramClient(token, fetcher = fetch) {
  if (!token) throw new TelegramError('Configura TELEGRAM_BOT_TOKEN en .env.');
  return {
    async call(method, data = {}) {
      let response;
      try {
        response = await fetcher(`https://api.telegram.org/bot${token}/${method}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
          signal: AbortSignal.timeout(35000),
        });
      } catch {
        throw new TelegramError('No se pudo confirmar la respuesta de Telegram.', true);
      }
      let body;
      try {
        body = await response.json();
      } catch {
        throw new TelegramError('Respuesta de Telegram ilegible.', true);
      }
      if (!response.ok || !body.ok)
        throw new TelegramError(
          `Telegram rechazó la solicitud (${body.error_code || response.status}).`,
          response.status >= 500,
        );
      return body.result;
    },
  };
}
