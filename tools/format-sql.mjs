import { readFileSync, writeFileSync } from 'node:fs';
import { formatSql } from './sql-style.mjs';
const path = new URL('../script/LaPreDigital_OLTP.sql', import.meta.url);
const source = readFileSync(path, 'utf8');
const result = formatSql(source);
if (process.argv.includes('--check')) {
  if (result !== source) {
    console.error('El script SQL requiere formato: ' + path.pathname);
    process.exitCode = 1;
  }
} else writeFileSync(path, result);
