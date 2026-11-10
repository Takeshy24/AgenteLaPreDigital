import { format } from 'sql-formatter';
export function formatSql(source) {
  const batches = [];
  let start = 0;
  for (const token of source.matchAll(/'(?:''|[^'])*'|--[^\n]*|\/\*[\s\S]*?\*\/|\bGO\b/g)) {
    if (token[0] !== 'GO') continue;
    batches.push(source.slice(start, token.index).trim());
    start = token.index + 2;
  }
  batches.push(source.slice(start).trim());
  return (
    batches
      .filter(Boolean)
      .map((batch) => format(batch, { language: 'transactsql', tabWidth: 4, keywordCase: 'upper' }))
      .join('\n\nGO\n\n') + '\n'
  );
}
