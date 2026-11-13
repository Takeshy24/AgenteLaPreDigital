export const MIN_RECOMMENDATION_LEADS = 50;
export const MIN_RECOMMENDATION_COHORT = 5;
const normalize = (value) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

export function rankPlans(profile, tariffs, history = []) {
  const budget = Number(profile.budget);
  if (profile.budget == null || !Number.isFinite(budget) || budget < 0)
    return { options: [], cohortSize: 0, usesHistory: false, sameAvailability: false };
  const unique = new Map();
  for (const item of history) {
    if (
      normalize(item.career) &&
      normalize(item.career) === normalize(profile.career) &&
      !unique.has(item.beneficiaryId)
    )
      unique.set(item.beneficiaryId, item);
  }
  let cohort = [...unique.values()];
  const available = cohort.filter(
    (item) =>
      normalize(profile.availability) &&
      normalize(item.availability) === normalize(profile.availability),
  );
  const sameAvailability = available.length >= MIN_RECOMMENDATION_COHORT;
  if (sameAvailability) cohort = available;
  const usesHistory = cohort.length >= MIN_RECOMMENDATION_COHORT;
  const choices = new Map();
  if (usesHistory)
    for (const item of cohort) choices.set(item.plan, (choices.get(item.plan) ?? 0) + 1);
  const monthly = new Map();
  for (const tariff of tariffs) {
    if (
      tariff.modalidad === 'Mensual' &&
      Number(tariff.precio) > 0 &&
      Number(tariff.precio) <= budget
    )
      if (
        !monthly.has(tariff.plan) ||
        Number(tariff.precio) < Number(monthly.get(tariff.plan).precio)
      )
        monthly.set(tariff.plan, tariff);
  }
  const options = [...monthly.values()]
    .map((tariff) => ({ tariff, selectedBy: choices.get(tariff.plan) ?? 0 }))
    .sort(
      (a, b) =>
        b.selectedBy - a.selectedBy ||
        Number(b.tariff.precio) - Number(a.tariff.precio) ||
        a.tariff.plan.localeCompare(b.tariff.plan),
    )
    .slice(0, 3);
  return { options, cohortSize: usesHistory ? cohort.length : 0, usesHistory, sameAvailability };
}

export function recommendationIntro(profile, ranked, audience) {
  const name = audience.student ? 'tu preparación' : `la preparación de ${audience.name}`;
  const best = ranked.options[0];
  if (!best) return `Con el presupuesto que me compartiste, revisemos Explora UNT para ${name}.`;
  let text = `Para ${name} en ${profile.career || 'la UNT'}, mi primera opción es ${best.tariff.plan}. Recomiendo las modalidades mensuales que caben en el presupuesto que me indicaste.`;
  if (ranked.usesHistory && best.selectedBy > 0)
    text += ` En el historial registrado, ${best.selectedBy} de ${ranked.cohortSize} estudiantes con esa carrera${ranked.sameAvailability ? ' y disponibilidad' : ''} tienen una contratación pagada y validada de ${best.tariff.plan}. Esto refleja elecciones de compra, no resultados académicos.`;
  else if (ranked.usesHistory)
    text +=
      ' El historial comparable no tiene elecciones de estas alternativas dentro de tu presupuesto; priorizo ese límite.';
  else
    text +=
      ' Todavía no hay suficiente historial comparable para atribuir preferencias a estudiantes de esa carrera; priorizo tu presupuesto.';
  return text;
}
