import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { formatSql } from './sql-style.mjs';
const root = new URL('../script/', import.meta.url);
const paths = [
  new URL('LaPreDigital_OLTP.sql', root),
  ...readdirSync(new URL('migrations/', root))
    .filter((file) => file.endsWith('.sql'))
    .map((file) => new URL('migrations/' + file, root)),
];
for (const path of paths) {
  const source = readFileSync(path, 'utf8');
  const result = formatSql(source);
  if (process.argv.includes('--check')) {
    if (result !== source) {
      console.error('El script SQL requiere formato: ' + path.pathname);
      process.exitCode = 1;
    }
  } else writeFileSync(path, result);
}
