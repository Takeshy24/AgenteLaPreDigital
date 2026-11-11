import 'dotenv/config';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('../script/LaPreDigital_OLTP.sql', import.meta.url));
const configured = process.env.DB_SERVER || 'localhost';
const server = /[\\,:]/.test(configured) ? configured : `tcp:${configured}`;
const login = process.env.DB_USER
  ? ['-U', process.env.DB_USER, '-P', process.env.DB_PASSWORD ?? '']
  : ['-E'];

if (process.argv.includes('--check')) {
  console.log(`Se aplicaría ${script} en ${server}`);
  process.exit(0);
}
const result = spawnSync(
  'sqlcmd',
  ['-S', server, ...login, '-C', '-I', '-b', '-f', '65001', '-i', script],
  { stdio: 'inherit' },
);
if (result.error) {
  console.error('No se pudo ejecutar sqlcmd. Instálalo o ejecuta el script desde SSMS.');
  process.exit(1);
}
process.exit(result.status ?? 1);
