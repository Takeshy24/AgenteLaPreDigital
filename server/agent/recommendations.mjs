import { pool, transaction } from '../db.mjs';
import { BusinessError } from '../shared/errors.mjs';
import { getPolicy, savePolicy } from './policy.mjs';
import { countLeads, listPlanChoices } from './recommendation-repository.mjs';
import {
  MIN_RECOMMENDATION_LEADS,
  MIN_RECOMMENDATION_COHORT,
  rankPlans,
  recommendationIntro,
} from './recommendation-rules.mjs';
import { knowledgeFragments, NO_INFORMATION } from '../knowledge/service.mjs';
import { answerFromKnowledge } from './knowledge.mjs';
import { publicTariffs } from '../public/repository.mjs';

export async function getRecommendationSettings(db = null) {
  db ??= await pool();
  const policy = await getPolicy(db);
  const leads = await countLeads(db);
  const eligible = leads >= MIN_RECOMMENDATION_LEADS;
  return {
    configured: policy.useLeadData,
    enabled: policy.useLeadData && eligible,
    eligible,
    leads,
    minimum: MIN_RECOMMENDATION_LEADS,
    minimumCohort: MIN_RECOMMENDATION_COHORT,
    version: policy.version,
  };
}
export async function setRecommendationSettings({ enabled, version }) {
  return transaction(async (db) => {
    const policy = await getPolicy(db, { lock: true });
    if (policy.version !== version)
      throw new BusinessError('La configuración cambió. Actualiza el apartado antes de guardar.');
    await savePolicy({ ...policy, useLeadData: enabled });
    return getRecommendationSettings(db);
  });
}
function shortDocument(text, limit) {
  if (text.length <= limit) return text;
  const end = text.lastIndexOf('\n', limit);
  const space = text.lastIndexOf(' ', limit);
  return text.slice(0, end > 0 ? end : space > 0 ? space : limit).trim() + '\n…';
}
export async function buildDataRecommendation(
  db,
  profile,
  tariffs,
  audience,
  { simulation = false, excludeBeneficiary = null } = {},
) {
  const settings = await getRecommendationSettings(db);
  if (!simulation && !settings.enabled) return null;
  const history = simulation
    ? Array.from({ length: 8 }, (_, index) => ({
        beneficiaryId: index + 1,
        career: profile.career,
        availability: profile.availability,
        plan: index < 6 ? 'Meta UNT' : 'Ruta UNT',
      }))
    : await listPlanChoices(db, excludeBeneficiary);
  const ranked = rankPlans(profile, tariffs, history);
  const documents = await knowledgeFragments();
  const options = ranked.options.length ? ranked.options : [{ tariff: null, selectedBy: 0 }];
  const sections = [];
  const offered = [];
  const displayedOptions = [];
  for (const option of options) {
    const plan = option.tariff?.plan ?? 'Explora UNT';
    const answer = answerFromKnowledge(`Qué incluye ${plan}`, [], documents);
    if (!answer) continue;
    const index = sections.length;
    sections.push(
      `${index === 0 ? 'Mi primera opción' : 'Otra alternativa'}: ${plan}\n${shortDocument(answer.text, index === 0 ? 1100 : 550)}`,
    );
    if (option.tariff) {
      offered.push(option.tariff);
      displayedOptions.push(option);
    }
  }
  const text = sections.length
    ? `${simulation ? 'EJEMPLO SIMULADO · las cifras de elección son ficticias.\n\n' : ''}${recommendationIntro(profile, { ...ranked, options: displayedOptions }, audience)}\n\n${sections.join('\n\n')}`
    : NO_INFORMATION;
  return {
    text,
    tariff: offered[0] ?? null,
    alternatives: offered,
    hasInformation: sections.length > 0,
    usesHistory: ranked.usesHistory,
    cohortSize: ranked.cohortSize,
    simulation,
  };
}
export async function previewRecommendation(data) {
  const db = await pool();
  const result = await buildDataRecommendation(
    db,
    data,
    await publicTariffs(db),
    { student: true },
    { simulation: data.simulation },
  );
  if (!result)
    throw new BusinessError(
      'Activa las recomendaciones con datos cuando haya al menos 50 LEADs. La simulación de ejemplo está disponible sin activarlas.',
    );
  return result;
}
