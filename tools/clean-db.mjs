import 'dotenv/config';
import { spawnSync } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('../script/limpiar_datos.sql', import.meta.url));
const flags = { local: ['--local'], remote: ['--remote', '--remoto'], global: ['--global'] };
const scopes = Object.keys(flags).filter((scope) =>
  flags[scope].some((flag) => process.argv.includes(flag)),
);
const words = { local: 'LOCAL', remote: 'REMOTO', global: 'GLOBAL' };

const usage = `Uso: npm run db:clean -- --local | --remote | --global [--yes]

  --local    limpia la base de esta PC (DB_SERVER y DB_DATABASE del .env)
  --remote   (o --remoto) limpia la base remota (REMOTE_DB_SERVER, REMOTE_DB_DATABASE,
             REMOTE_DB_USER y REMOTE_DB_PASSWORD del .env)
  --global   limpia las dos
  --yes      no pide confirmación`;

if (scopes.length !== 1) {
  console.error(usage);
  process.exit(1);
}
const scope = scopes[0];

function connection(name, prefix) {
  const configured = process.env[`${prefix}SERVER`] || (name === 'local' ? 'localhost' : '');
  const user = process.env[`${prefix}USER`];
  return {
    name,
    server: /[\\,:]/.test(configured) ? configured : `tcp:${configured}`,
    configured,
    database: process.env[`${prefix}DATABASE`] || 'LaPreDigital_OLTP',
    login: user ? ['-U', user, '-P', process.env[`${prefix}PASSWORD`] ?? ''] : ['-E'],
  };
}
const local = connection('local', 'DB_');
const remote = connection('remote', 'REMOTE_DB_');
const targets = scope === 'global' ? [local, remote] : scope === 'remote' ? [remote] : [local];

if (targets.includes(remote) && !remote.configured) {
  console.error('Falta REMOTE_DB_SERVER en .env. No se borró nada.');
  process.exit(1);
}
function runScript(target, mode) {
  const result = spawnSync(
    'sqlcmd',
    [
      '-S',
      target.server,
      ...target.login,
      '-d',
      target.database,
      '-C',
      '-I',
      '-b',
      '-W',
      '-s',
      ' | ',
      '-f',
      '65001',
      '-i',
      script,
      '-v',
      `MODO=${mode}`,
    ],
    { encoding: 'utf8' },
  );
  if (result.error) {
    console.error(
      'No se pudo ejecutar sqlcmd. Instálalo o ejecuta script/limpiar_datos.sql desde SSMS.',
    );
    process.exit(1);
  }
  if (result.status !== 0) {
    console.error(`[${target.name}] ${result.stdout || result.stderr}`);
    process.exit(result.status ?? 1);
  }
  return result.stdout.trim();
}

function identity(target) {
  const result = spawnSync(
    'sqlcmd',
    [
      '-S',
      target.server,
      ...target.login,
      '-d',
      target.database,
      '-C',
      '-I',
      '-b',
      '-h',
      '-1',
      '-W',
      '-Q',
      "SET NOCOUNT ON; SELECT @@SERVERNAME + '/' + DB_NAME()",
    ],
    { encoding: 'utf8' },
  );
  if (result.status !== 0) {
    console.error(
      `[${target.name}] No se pudo conectar: ${(result.stdout || result.stderr).trim()}`,
    );
    process.exit(1);
  }
  return result.stdout.trim().toLowerCase();
}
if (scope === 'global' && identity(local) === identity(remote)) {
  console.error(
    'La base remota es la misma que la local (mismo servidor y base). Revisa REMOTE_DB_* en .env. No se borró nada.',
  );
  process.exit(1);
}

console.log(
  'Se borran contactos, LEADs, casos, mensajes, eventos, solicitudes, vínculos de Telegram y demás datos de uso.',
);
console.log(
  'Se conservan catálogos, parámetros, planes, tarifas, operadores y el cursor de Telegram.',
);
for (const target of targets) {
  console.log(`\n[${target.name}] Base: ${target.database} en ${target.server}`);
  console.log(runScript(target, 'resumen'));
}

if (!process.argv.includes('--yes')) {
  const word = words[scope];
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(
    `\nEscribe ${word} para borrar estos datos (otra cosa cancela): `,
  );
  rl.close();
  if (answer.trim() !== word) {
    console.log('Cancelado. No se borró nada.');
    process.exit(0);
  }
}

for (const target of targets) {
  runScript(target, 'limpiar');
  console.log(`\n[${target.name}] Después de limpiar:`);
  console.log(runScript(target, 'resumen'));
}
console.log('\nListo. Los identificadores vuelven a empezar en 1.');
