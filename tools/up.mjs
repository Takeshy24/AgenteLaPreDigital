import 'dotenv/config';
import { spawn, spawnSync } from 'node:child_process';

const checkOnly = process.argv.includes('--check');
const port = Number(process.env.PORT || 3067);
const localUrl = `http://127.0.0.1:${port}`;
const publicOrigin = process.env.PUBLIC_ORIGIN || '';
const ollamaUrl = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
const children = [];

function log(label, message) {
  console.log(`[${label}] ${message}`);
}

async function responds(url) {
  try {
    await fetch(url, { signal: AbortSignal.timeout(1500) });
    return true;
  } catch {
    return false;
  }
}

async function waitFor(url, seconds) {
  for (let attempt = 0; attempt < seconds; attempt++) {
    if (await responds(url)) return true;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  return false;
}

function commandExists(command) {
  return spawnSync(command, ['version'], { stdio: 'ignore' }).status === 0;
}

function prefixLines(label, stream, keep = () => true) {
  let pending = '';
  stream.on('data', (chunk) => {
    const lines = (pending + chunk).split(/\r?\n/);
    pending = lines.pop();
    for (const line of lines) if (line.trim() && keep(line)) log(label, line);
  });
}

function stopAll(code = 0) {
  for (const child of children) if (!child.killed) child.kill();
  setTimeout(() => process.exit(code), 500);
}

async function prepareOllama() {
  if (process.env.OLLAMA_ENABLED !== 'true') return log('ollama', 'desactivado en .env');
  if (await responds(ollamaUrl)) return log('ollama', `activo en ${ollamaUrl}`);
  if (checkOnly) return log('ollama', `no responde en ${ollamaUrl}; npm run up lo iniciará`);
  log('ollama', 'no responde; iniciando ollama serve');
  const child = spawn('ollama', ['serve'], { stdio: 'ignore', detached: true });
  child.on('error', () => log('ollama', 'no se pudo iniciar: instala Ollama o ábrelo manualmente'));
  child.unref();
  if (await waitFor(ollamaUrl, 15)) log('ollama', 'activo');
  else log('ollama', 'sigue sin responder; el agente funcionará sin análisis hasta que se inicie');
}

async function main() {
  if (await responds(`${localUrl}/api/health`)) {
    console.error(
      `Ya hay un servidor en ${localUrl}. Detén ese proceso (Ctrl+C en su terminal) y vuelve a ejecutar.`,
    );
    process.exit(1);
  }
  if (publicOrigin && !commandExists('ngrok')) {
    console.error(
      'No se encontró ngrok. Instálalo o comenta PUBLIC_ORIGIN en .env para trabajar solo en local.',
    );
    process.exit(1);
  }
  await prepareOllama();
  if (checkOnly) {
    log('check', `servidor libre en ${localUrl}`);
    log(
      'check',
      publicOrigin
        ? `túnel: ${new URL(publicOrigin).hostname} → ${port}`
        : 'sin túnel (solo local)',
    );
    return;
  }

  log('build', 'compilando la interfaz');
  if (spawnSync('npm.cmd', ['run', 'build'], { stdio: 'inherit', shell: true }).status !== 0) {
    console.error('La compilación falló.');
    process.exit(1);
  }

  const server = spawn(process.execPath, ['server/index.mjs'], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  children.push(server);
  prefixLines('servidor', server.stdout);
  prefixLines('servidor', server.stderr);
  server.on('exit', (code) => {
    log('servidor', `terminó (código ${code}); deteniendo todo`);
    stopAll(code || 1);
  });
  if (!(await waitFor(`${localUrl}/api/health`, 30))) {
    console.error('El servidor no respondió en 30 segundos. Revisa los mensajes anteriores.');
    return stopAll(1);
  }

  if (publicOrigin) {
    const tunnel = spawn(
      'ngrok',
      ['http', `--url=${new URL(publicOrigin).hostname}`, String(port), '--log=stdout'],
      { stdio: ['ignore', 'pipe', 'pipe'] },
    );
    children.push(tunnel);
    const relevant = (line) => /started tunnel|lvl=(eror|crit|warn)|err=/.test(line);
    prefixLines('ngrok', tunnel.stdout, relevant);
    prefixLines('ngrok', tunnel.stderr);
    tunnel.on('exit', (code) => {
      log('ngrok', `terminó (código ${code}); deteniendo todo`);
      stopAll(code || 1);
    });
  }

  console.log('');
  log('listo', `consola:  ${localUrl}`);
  log('listo', `landing:  ${localUrl}/landing`);
  if (publicOrigin) log('listo', `público:  ${publicOrigin}`);
  if (process.env.LANDING_ORIGINS)
    log('listo', `páginas autorizadas: ${process.env.LANDING_ORIGINS}`);
  log('listo', 'Ctrl+C detiene el servidor y el túnel');
}

for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => stopAll(0));
await main();
