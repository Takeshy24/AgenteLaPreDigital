import { insideServiceWindow } from './repository.mjs';
import { pool } from '../db.mjs';
import { whatsappRecipient } from './whatsapp-identity.mjs';
import { welcomeTemplate } from './welcome-rules.mjs';

const clean = (text) =>
  String(text)
    .replace(/[\n\t\r]+/g, ' ')
    .replace(/ {5,}/g, '    ')
    .trim();

// Dentro de las 24 horas posteriores al último mensaje del contacto se puede escribir libremente
// (texto o lista de opciones). Fuera de esa ventana, WhatsApp solo admite una plantilla aprobada.
export async function whatsappPayload(message, config) {
  const recipient = whatsappRecipient(
    message.whatsappUserId || String(message.telefono).replace(/\D/g, ''),
  );
  if (await insideServiceWindow(await pool(), message.idContacto)) {
    const markup = message.markup ? JSON.parse(message.markup) : null;
    const rows = (markup?.inline_keyboard ?? [])
      .flat()
      .slice(0, 10)
      .map((button) => ({ id: button.callback_data, title: button.text.slice(0, 24) }));
    if (markup?.consent_prompt)
      return {
        ...recipient,
        type: 'interactive',
        interactive: {
          type: 'button',
          body: { text: message.textoMensaje.slice(0, 1024) },
          action: {
            buttons: rows.slice(0, 3).map((row) => ({
              type: 'reply',
              reply: { id: row.id, title: row.title.slice(0, 20) },
            })),
          },
        },
      };
    if (rows.length)
      return {
        ...recipient,
        type: 'interactive',
        interactive: {
          type: 'list',
          body: { text: message.textoMensaje.slice(0, 1024) },
          action: { button: 'Ver opciones', sections: [{ title: 'Opciones', rows }] },
        },
      };
    return {
      ...recipient,
      type: 'text',
      text: { body: message.textoMensaje.slice(0, 4096), preview_url: false },
    };
  }
  if (
    message.credentials &&
    (!config.credentialsTemplateName || config.credentialsTemplateName === 'hello_world')
  ) {
    const error = new Error('Falta una plantilla de credenciales aprobada para WhatsApp.');
    error.uncertain = false;
    throw error;
  }
  const welcome = message.markup ? JSON.parse(message.markup).welcome : null;
  if (welcome?.source === 'landing') {
    const selected = welcomeTemplate(config);
    if (!selected) {
      const error = new Error('La bienvenida espera una plantilla aprobada de WhatsApp.');
      error.uncertain = false;
      throw error;
    }
    return {
      ...recipient,
      type: 'template',
      template: {
        name: selected.name,
        language: { code: selected.language },
        ...(selected.parameter === 'none'
          ? {}
          : {
              components: [
                {
                  type: 'body',
                  parameters: [
                    {
                      type: 'text',
                      text:
                        selected.parameter === 'name'
                          ? welcome.name
                          : clean(message.textoMensaje).slice(0, 900),
                    },
                  ],
                },
              ],
            }),
      },
    };
  }
  const templateName = message.credentials ? config.credentialsTemplateName : config.templateName;
  const template = {
    name: templateName,
    language: { code: config.templateLanguage },
  };
  if (templateName !== 'hello_world')
    template.components = [
      {
        type: 'body',
        parameters: [{ type: 'text', text: clean(message.textoMensaje).slice(0, 900) }],
      },
    ];
  return { ...recipient, type: 'template', template };
}
