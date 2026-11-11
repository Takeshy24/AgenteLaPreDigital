import { insideServiceWindow } from './repository.mjs';
import { pool } from '../db.mjs';

const clean = (text) =>
  String(text)
    .replace(/[\n\t\r]+/g, ' ')
    .replace(/ {5,}/g, '    ')
    .trim();

// Dentro de las 24 horas posteriores al último mensaje del contacto se puede escribir libremente
// (texto o lista de opciones). Fuera de esa ventana, WhatsApp solo admite una plantilla aprobada.
export async function whatsappPayload(message, config) {
  const to = String(message.telefono).replace(/\D/g, '');
  if (await insideServiceWindow(await pool(), message.idContacto)) {
    const markup = message.markup ? JSON.parse(message.markup) : null;
    const rows = (markup?.inline_keyboard ?? [])
      .flat()
      .slice(0, 10)
      .map((button) => ({ id: button.callback_data, title: button.text.slice(0, 24) }));
    if (rows.length)
      return {
        to,
        type: 'interactive',
        interactive: {
          type: 'list',
          body: { text: message.textoMensaje.slice(0, 1024) },
          action: { button: 'Ver opciones', sections: [{ title: 'Opciones', rows }] },
        },
      };
    return {
      to,
      type: 'text',
      text: { body: message.textoMensaje.slice(0, 4096), preview_url: false },
    };
  }
  const template = {
    name: config.templateName,
    language: { code: config.templateLanguage },
  };
  if (config.templateName !== 'hello_world')
    template.components = [
      {
        type: 'body',
        parameters: [{ type: 'text', text: clean(message.textoMensaje).slice(0, 900) }],
      },
    ];
  return { to, type: 'template', template };
}
