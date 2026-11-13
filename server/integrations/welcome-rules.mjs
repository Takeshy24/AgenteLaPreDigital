export const LANDING_WELCOME_TEXT =
  '¡Hola! Gracias por registrarte en LaPreDigital. Soy el asistente y te ayudaré con tu preparación para la UNT. Responde este mensaje y comenzamos. Si no deseas recibir más mensajes, escribe NO ME CONTACTEN.';

export function welcomeTemplate(config) {
  const name = config.welcomeTemplateName;
  const language = config.welcomeTemplateLanguage;
  const parameter = config.welcomeTemplateParameter ?? 'none';
  if (!name || name === 'hello_world' || !/^[a-z0-9_]+$/.test(name)) return null;
  if (!language || !/^[a-z]{2,3}(?:_[A-Z]{2})?$/.test(language)) return null;
  if (!['none', 'name', 'message'].includes(parameter)) return null;
  return { name, language, parameter };
}
