import { normalize, mentionedPlans } from './knowledge.mjs';

// Selecciona líneas del documento recuperado; no añade beneficios ni precios del catálogo.
export function summarizePlan(text, plan, { benefits = 3, limit = 320 } = {}) {
  const lines = String(text ?? '')
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*(?:[-*•]\s+|#{1,6}\s*)/, '').trim())
    .filter(Boolean)
    .filter((line) => {
      const plans = mentionedPlans(line);
      return !plans.length || (plans.length === 1 && plans[0] === plan);
    });
  const price = lines
    .map((line) => line.split(/\s*[·|]\s*/).find((part) => /^mensual\s*:/i.test(part)))
    .find(Boolean);
  const free = lines.find((line) => /prueba gratuita|d[ií]as gratuitos/i.test(line));
  const selected = price ? [price] : free ? [free] : [];
  const candidates = lines
    .filter((line) => {
      const value = normalize(line);
      return (
        line.includes(':') &&
        !mentionedPlans(line).length &&
        !/ (no|no incluido|no disponible|no incluye|sin acceso) /.test(value) &&
        !/mensual|semestral|precio|tarifa/i.test(line) &&
        line.length <= 100
      );
    })
    .map((line, index) => ({
      line: line.replace(/:\s*s[ií][.!]?$/i, '.'),
      rank: /videoclases|ejercicios por|simulacros completos/i.test(line) ? 0 : 1,
      index,
    }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index);
  let count = 0;
  for (const { line } of candidates) {
    if (count >= benefits) break;
    const bullet = `• ${line}`;
    if ([...selected, bullet].join('\n').length > limit) continue;
    if (selected.includes(bullet)) continue;
    selected.push(bullet);
    count++;
  }
  if (!selected.length) {
    const sentence = lines
      .filter((line) => normalize(line) !== normalize(plan))
      .flatMap((line) => line.match(/[^.!?]+[.!?](?:\s|$)|[^.!?]+$/g) ?? [])
      .map((line) => line.trim())
      .find((line) => line.length <= limit);
    if (sentence) selected.push(sentence);
  }
  return selected.join('\n');
}
