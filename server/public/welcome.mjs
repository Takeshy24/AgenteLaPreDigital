import { integrationConfig } from '../integrations/config.mjs';
import { insideServiceWindow } from '../integrations/repository.mjs';
import { LANDING_WELCOME_TEXT, welcomeTemplate } from '../integrations/welcome-rules.mjs';
import { firstWelcomeAttempt, queueWelcome } from './welcome-repository.mjs';

export async function prepareLandingWelcome(db, lead, channels) {
  if (!channels.includes(1)) return null;
  if (!lead.id || lead.review) return { state: 'review' };
  const attempt = await firstWelcomeAttempt(db, lead.id);
  if (!attempt) return null;
  await queueWelcome(db, lead.id, attempt, LANDING_WELCOME_TEXT);
  const config = integrationConfig().whatsapp;
  if (!config.enabled || !config.token || !config.phoneNumberId)
    return { state: 'waiting-channel' };
  return {
    state:
      (await insideServiceWindow(db, lead.contact)) || welcomeTemplate(config)
        ? 'queued'
        : 'waiting-template',
  };
}
