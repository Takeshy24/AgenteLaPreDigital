import { z } from 'zod';
import { pool, transaction } from '../db.mjs';
import { readPolicy, updatePolicy } from './policy-repository.mjs';
import { BusinessError } from '../shared/errors.mjs';
import { countLeads } from './recommendation-repository.mjs';
import { MIN_RECOMMENDATION_LEADS } from './recommendation-rules.mjs';

export const defaultPolicy = {
  profileQuestions: true,
  optionalQuestions: true,
  recommendAfterProfile: true,
  proposalLinks: true,
  trialLinks: true,
  guardianInvitations: true,
  useLeadData: false,
  questionOrder: ['career', 'availability', 'budget'],
};
export const policySchema = z
  .object({
    profileQuestions: z.boolean(),
    optionalQuestions: z.boolean(),
    recommendAfterProfile: z.boolean(),
    proposalLinks: z.boolean(),
    trialLinks: z.boolean(),
    guardianInvitations: z.boolean(),
    useLeadData: z.boolean().default(false),
    questionOrder: z
      .array(z.enum(['career', 'availability', 'budget']))
      .length(3)
      .refine((value) => new Set(value).size === 3, 'Incluye cada pregunta una sola vez.'),
  })
  .strict();

export async function getPolicy(db = null, options = {}) {
  db ??= await pool();
  const row = await readPolicy(db, options);
  if (!row)
    throw new BusinessError(
      'Falta configurar las reglas del agente. Ejecuta npm run migrate.',
      503,
    );
  return { ...policySchema.parse(JSON.parse(row.settings)), version: row.version };
}
export async function savePolicy(data) {
  const settings = policySchema.parse(
    Object.fromEntries(Object.entries(data).filter(([key]) => key !== 'version')),
  );
  return transaction(async (db) => {
    const current = await getPolicy(db, { lock: true });
    if (current.version !== data.version)
      throw new BusinessError('Las reglas cambiaron en otra sesión. Recarga antes de guardar.');
    if (
      settings.useLeadData &&
      !current.useLeadData &&
      (await countLeads(db)) < MIN_RECOMMENDATION_LEADS
    )
      throw new BusinessError(
        `Se necesitan al menos ${MIN_RECOMMENDATION_LEADS} LEADs registrados para activar las recomendaciones con datos.`,
      );
    await updatePolicy(db, settings, data.version);
    return getPolicy(db);
  });
}
