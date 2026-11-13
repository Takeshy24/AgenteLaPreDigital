import { words } from './intents.mjs';

export function isRegistrationGreeting(text) {
  const value = words(text).trim();
  return /^(?:hola |buenas )?(?:ya me registre|me acabo de registrar|ya estoy registrad[oa]|ya complete (?:el |mi )?(?:formulario|registro)|ya llene (?:el |mi )?formulario)(?: en (?:la pre digital|lapredigital))?$/.test(
    value,
  );
}
export function isSimpleGreeting(text) {
  return /^(hola|buenas|buen dia|buenos dias|buenas tardes|buenas noches|hi|hello|inicio|empezar|start)$/.test(
    words(text).trim(),
  );
}
