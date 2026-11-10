import { createHash, randomBytes } from 'node:crypto';
import { analyzeMessage, ollamaStatus } from '../agent/ollama.mjs';
import { transaction } from '../db.mjs';
import { BusinessError } from '../shared/errors.mjs';
import { getParticipation } from '../shared/repository.mjs';
import { getWorkspace } from '../workspace/repository.mjs';
import { integrationConfig } from './config.mjs';
import * as repository from './repository.mjs';
export const hashCode = (code) => createHash('sha256').update(code).digest('hex');
export async function createTelegramLink(id) {
  const config = integrationConfig().telegram;
  if (!config.username)
    throw new BusinessError(
      'Configura TELEGRAM_BOT_USERNAME después de crear el bot en BotFather.',
    );
  return transaction(async (db) => {
    const participation = await getParticipation(db, id);
    const code = randomBytes(24).toString('base64url');
    await repository.saveLink(db, participation.idContacto, hashCode(code));
    return {
      url: `https://t.me/${config.username.replace(/^@/, '')}?start=${code}`,
      expiresInMinutes: 10,
    };
  });
}
export async function getIntegrationStatus() {
  const config = integrationConfig();
  return {
    telegram: {
      configured: !!config.telegram.token && !!config.telegram.username,
      enabled: config.telegram.enabled,
    },
    ollama: await ollamaStatus(),
    followup: { enabled: config.followup.enabled },
  };
}
export async function analyze(id, data) {
  const context = await getWorkspace();
  if (!context.leads.some((lead) => lead.id === id))
    throw new BusinessError('Participación no encontrada', 404);
  const participant = context.leads.find((lead) => lead.id === id);
  return analyzeMessage(data.text, context.tariffs, {
    context: {
      contact: participant.name,
      beneficiary: participant.beneficiary,
      role: participant.role,
    },
  });
}
