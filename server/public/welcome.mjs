import { integrationConfig } from '../integrations/config.mjs';
import { insideServiceWindow } from '../integrations/repository.mjs';
import { LANDING_WELCOME_TEXT, welcomeTemplate } from '../integrations/welcome-rules.mjs';
import { firstWelcomeAttempt, queueWelcome } from './welcome-repository.mjs';

// WhatsApp solo deja escribir primero con una plantilla aprobada por Meta (welcomeReady) o dentro de
// las 24 horas desde el último mensaje del contacto. Si no se puede y el contacto autorizó el correo,
// la bienvenida no se encola por WhatsApp: el correo de registro cumple el primer intento.
export async function prepareLandingWelcome(db, lead, channels, { welcomeReady = true } = {}) {
  if (!channels.includes(1)) return null;
  if (!lead.id || lead.review) return { state: 'review' };
  const attempt = await firstWelcomeAttempt(db, lead.id);
  if (!attempt) return null;
  const config = integrationConfig().whatsapp;
  const inside = await insideServiceWindow(db, lead.contact);
  if (channels.includes(2) && !inside && !(welcomeReady && welcomeTemplate(config)))
    return { state: 'email' };
  await queueWelcome(db, lead.id, attempt, LANDING_WELCOME_TEXT);
  if (!config.enabled || !config.token || !config.phoneNumberId)
    return { state: 'waiting-channel' };
  return { state: inside || welcomeTemplate(config) ? 'queued' : 'waiting-template' };
}
