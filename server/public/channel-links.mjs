import { integrationConfig } from '../integrations/config.mjs';

export function telegramBotUrl() {
  const { username } = integrationConfig().telegram;
  return username ? `https://t.me/${username.replace(/^@/, '')}` : null;
}

export function whatsappUrl() {
  const digits = String(process.env.WHATSAPP_PUBLIC_NUMBER || '').replace(/[^0-9]/g, '');
  const number = /^9[0-9]{8}$/.test(digits) ? '51' + digits : digits;
  if (!/^[0-9]{8,15}$/.test(number)) return null;
  return `https://wa.me/${number}?text=${encodeURIComponent('Hola, ya me registré en LaPreDigital')}`;
}

export function publicChatLinks() {
  return { whatsappUrl: whatsappUrl(), telegramUrl: telegramBotUrl() };
}
