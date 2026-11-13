import { searchDocuments } from '../knowledge/search.mjs';

export const normalize = (text) =>
  ` ${String(text ?? '')
    .toLowerCase()
    .normalize('NFD')
    .split('')
    .filter((char) => char.charCodeAt(0) < 0x300 || char.charCodeAt(0) > 0x36f)
    .join('')
    .replace(/[^a-z0-9%]+/g, ' ')
    .trim()} `;

export function planMentions(text) {
  const value = normalize(text);
  const mentions = [];
  for (const match of value.matchAll(
    / (explora(?: unt)?|ruta(?: unt)?|meta(?: unt)?(?: plus)?|plus)(?= )/g,
  )) {
    const name = match[1];
    const plan = name.startsWith('explora')
      ? 'Explora UNT'
      : name.startsWith('ruta')
        ? 'Ruta UNT'
        : name.includes('plus')
          ? 'Meta UNT Plus'
          : 'Meta UNT';
    const before = value.slice(0, match.index + 1);
    const negated =
      / (no(?: (?:es|era|quiero|quisiera|deseo|prefiero|busco|me interesa|quiero contratar|quiero comprar|quiero pagar))?|en vez de|en lugar de)(?: (?:el|la|plan|del))* $/.test(
        before,
      );
    mentions.push({ plan, negated });
  }
  return mentions;
}

export const mentionedPlans = (text) => [
  ...new Set(
    planMentions(text)
      .filter((item) => !item.negated)
      .map((item) => item.plan),
  ),
];

// Solo los documentos activos de SQL alimentan las respuestas informativas.
// Las tarifas se siguen usando al ejecutar operaciones, nunca como respaldo de esta búsqueda.
export function retrieve(text, _tariffs = [], limit = 3, documents = []) {
  const plans = mentionedPlans(text);
  const scoped = documents.filter((item) => {
    const documentPlans = mentionedPlans(item.title);
    return (
      !plans.length || !documentPlans.length || plans.some((plan) => documentPlans.includes(plan))
    );
  });
  return searchDocuments(text, scoped, limit);
}

export function knowledgeContext(text, tariffs, documents = []) {
  return retrieve(text, tariffs, 3, documents).map(
    ({ chunk }) => `${chunk.title} [${chunk.source}]: ${chunk.render()}`,
  );
}

export function answerFromKnowledge(text, tariffs, documents = []) {
  const found = retrieve(text, tariffs, 2, documents).filter(
    (item, index, all) => index === 0 || item.score >= all[0].score,
  );
  if (!found.length) return null;
  return {
    text: found.map(({ chunk }) => chunk.render()).join('\n\n'),
    sources: found.map(({ chunk }) => ({ id: chunk.id, title: chunk.title, source: chunk.source })),
  };
}
export const sourcesOf = (text, tariffs, documents = []) =>
  retrieve(text, tariffs, 3, documents).map(({ chunk }) => ({
    id: chunk.id,
    source: chunk.source,
  }));
