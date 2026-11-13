const STOP = new Set(
  'a al algo como con cual cuando de del el ella en es esta este esto hay hola la las le lo los me mi mis no o para pero por puedo que quien se si sin son su sus te tengo tiene tienen tu un una uno y ya quiero quisiera saber favor gracias puedes'.split(
    ' ',
  ),
);
export const normalizeText = (value) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
export const tokens = (value) => [
  ...new Set((normalizeText(value).match(/[a-z0-9]{3,}/g) ?? []).filter((word) => !STOP.has(word))),
];

export function splitContent(content) {
  const result = [];
  let rest = content.trim();
  while (rest) {
    let end = Math.min(1600, rest.length);
    if (end < rest.length) {
      const boundary = rest.lastIndexOf('\n', end);
      const space = rest.lastIndexOf(' ', end);
      end = boundary > 800 ? boundary : space > 800 ? space : end;
    }
    result.push(rest.slice(0, end).trim());
    rest = rest.slice(end).trim();
  }
  return result;
}

export function searchDocuments(text, fragments, limit = 3) {
  const query = tokens(text);
  if (!query.length) return [];
  return fragments
    .map((item) => {
      const body = new Set(tokens(item.content));
      const title = new Set(tokens(item.title));
      const keywords = new Set(tokens(item.keywords));
      let matches = 0;
      let keywordMatches = 0;
      const score = query.reduce((sum, word) => {
        const hit = body.has(word) || title.has(word) || keywords.has(word);
        if (hit) matches++;
        if (keywords.has(word)) keywordMatches++;
        return (
          sum + (body.has(word) ? 1 : 0) + (title.has(word) ? 2 : 0) + (keywords.has(word) ? 3 : 0)
        );
      }, 0);
      return { ...item, score, matches, keywordMatches };
    })
    .filter(
      (item) =>
        item.score > 0 && (item.matches >= Math.min(2, query.length) || item.keywordMatches > 0),
    )
    .sort((a, b) => b.score - a.score || a.documentId - b.documentId || a.position - b.position)
    .slice(0, limit)
    .map((item) => ({
      score: item.score,
      chunk: {
        id: `documento:${item.documentId}:${item.position}:v${item.version}`,
        title: item.title,
        source: `${item.source || item.title} · documento ${item.documentId}, fragmento ${item.position}, versión ${item.version}`,
        render: () => item.content,
      },
    }));
}
