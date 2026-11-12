// Evalúa al agente (Ollama + reglas + base de conocimiento) con mensajes etiquetados según el informe.
// Solo lee el catálogo de la base; no escribe nada.
// Uso: npm run eval:agent [-- --runs 2] [-- --json salida.json] [-- --provider openai|ollama]
import { writeFileSync } from 'node:fs';
import { analyzeMessage } from '../server/agent/ollama.mjs';
import { handoffReason } from '../server/agent/service.mjs';
import { isSocialMessage } from '../server/agent/social.mjs';
import { close } from '../server/db.mjs';
import { getWorkspace } from '../server/workspace/repository.mjs';
import { CASES as MAIN, H } from './agent-eval-cases.mjs';
import { HOLDOUT } from './agent-eval-holdout.mjs';
const CASES = process.argv.includes('--holdout') ? HOLDOUT : MAIN;

const arg = (name) => {
  const index = process.argv.indexOf(name);
  return index > 0 ? process.argv[index + 1] : null;
};
const runs = Number(arg('--runs') ?? 1);
const tariffs = (await getWorkspace()).tariffs;
function behavior(text, analysis, error) {
  if (isSocialMessage(text)) return 'social';
  if (error || !analysis || analysis.understood === false) {
    const reason = handoffReason(text);
    return reason ? `handoff:${reason}` : 'unintelligible';
  }
  const reason = handoffReason(text) || (analysis.action === 'handoff' ? 7 : null);
  if (reason) return `handoff:${reason}`;
  if (analysis.guardian) return 'guardian-data';
  if (analysis.needsGuardian) return 'guardian-need';
  if (analysis.retraction) return 'retraction';
  if (analysis.accepts) return 'accept';
  if (analysis.action === 'proposal')
    return analysis.tariffId ? `proposal:${analysis.tariffId}` : 'proposal-ask';
  return analysis.action;
}
const behaviorOk = (got, accepted) =>
  accepted.includes(got) || (accepted.includes(H) && got.startsWith('handoff:'));

function score([text, level, accepted, extra = {}], analysis, error) {
  const got = behavior(text, analysis, error);
  const problems = [];
  if (!behaviorOk(got, accepted))
    problems.push(`acción «${got}» (esperada ${accepted.join(' o ')})`);
  const levels = level == null ? null : [].concat(level);
  const gotLevel = isSocialMessage(text) ? 1 : (analysis?.level ?? 1);
  if (levels && !got.startsWith('handoff') && !levels.includes(gotLevel))
    problems.push(`nivel ${gotLevel} (esperado ${levels.join(' o ')})`);
  const fields = Object.fromEntries(
    (analysis?.fields ?? []).map((item) => [item.field, item.value]),
  );
  if (
    extra.career &&
    !String(fields.career ?? '')
      .toLowerCase()
      .includes(extra.career)
  )
    problems.push(`carrera «${fields.career ?? '—'}» (esperada ~${extra.career})`);
  if (
    extra.availability &&
    !String(fields.availability ?? '')
      .toLowerCase()
      .includes(extra.availability)
  )
    problems.push(
      `disponibilidad «${fields.availability ?? '—'}» (esperada ~${extra.availability})`,
    );
  if (extra.budget != null && Number(fields.budget) !== extra.budget)
    problems.push(`presupuesto «${fields.budget ?? '—'}» (esperado ${extra.budget})`);
  if (extra.courses && !String(fields.courses ?? '').includes(extra.courses))
    problems.push(`cursos «${fields.courses ?? '—'}» (esperados ~${extra.courses})`);
  if (extra.applications && !String(fields.applications ?? '').includes(extra.applications))
    problems.push(
      `postulaciones «${fields.applications ?? '—'}» (esperadas ~${extra.applications})`,
    );
  if (extra.objection != null && analysis?.objection !== extra.objection)
    problems.push(`objeción ${analysis?.objection ?? '—'} (esperada ${extra.objection})`);
  if (extra.retraction != null && (analysis?.retraction ?? false) !== extra.retraction)
    problems.push(`retractación ${analysis?.retraction ?? false} (esperada ${extra.retraction})`);
  if (
    !extra.career &&
    fields.career &&
    !/carrera|estudiar|medicina|derecho|ingenier|enfermer/i.test(text)
  )
    problems.push(`carrera inventada «${fields.career}»`);
  if (extra.budget == null && fields.budget != null)
    problems.push(`presupuesto inventado «${fields.budget}»`);
  return { got, level: gotLevel, fields, problems };
}

const output = [];
for (let run = 1; run <= runs; run++)
  for (const item of CASES) {
    const [text, , , extra = {}] = item;
    const context = {
      contact: 'Ana Pérez',
      beneficiary: 'Ana Pérez',
      role: 'Estudiante',
      history: extra.history ?? [],
      requestedPlan: extra.requestedPlan ?? null,
    };
    let analysis = null;
    let error = null;
    const started = Date.now();
    if (!isSocialMessage(text))
      try {
        analysis = await analyzeMessage(text, tariffs, { context, provider: arg('--provider') });
      } catch (failure) {
        error = failure.message.slice(0, 200);
      }
    const result = score(item, analysis, error);
    output.push({ run, text, seconds: (Date.now() - started) / 1000, error, analysis, result });
    if (result.problems.length)
      console.log(`FALLA ${text} -> ${result.got} | ${result.problems.join('; ')}`);
  }
const providers = output.reduce((all, row) => {
  const name = row.analysis?.provider ?? (row.error ? 'error' : 'reglas');
  all[name] = (all[name] ?? 0) + 1;
  return all;
}, {});
console.log('Proveedor por mensaje:', JSON.stringify(providers));
const ok = output.filter((row) => !row.result.problems.length).length;
const times = output.map((row) => row.seconds).sort((a, b) => a - b);
console.log(`
Aciertos: ${ok} de ${output.length} (${Math.round((ok / output.length) * 100)} %). Tiempo mediano: ${times[Math.floor(times.length / 2)].toFixed(1)} s.`);
if (arg('--json')) writeFileSync(arg('--json'), JSON.stringify(output, null, 1));
await close();
process.exit(0);
