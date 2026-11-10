import 'dotenv/config';
import { AsyncLocalStorage } from 'node:async_hooks';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
const ambient = new AsyncLocalStorage();
class Connection {
  constructor() {
    this.queue = Promise.resolve();
    this.pending = null;
    this.process = spawn(
      'powershell.exe',
      [
        '-NoLogo',
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        readFileSync(new URL('./sql-worker.ps1', import.meta.url), 'utf8'),
      ],
      { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] },
    );
    this.stderr = '';
    this.process.stderr.on('data', (b) => (this.stderr += b.toString()));
    createInterface({ input: this.process.stdout }).on('line', (line) => {
      if (!this.pending) return;
      try {
        const response = JSON.parse(line);
        const p = this.pending;
        this.pending = null;
        response.error ? p.reject(new Error(response.error)) : p.resolve(response);
      } catch {
        this.pending.reject(new Error('Respuesta SQL inválida'));
        this.pending = null;
      }
    });
    this.process.on('exit', () => {
      this.dead = true;
      this.pending?.reject(new Error(this.stderr || 'Conexión SQL cerrada'));
      this.pending = null;
    });
    this.process.on('error', (e) => {
      this.dead = true;
      this.pending?.reject(e);
      this.pending = null;
    });
  }
  execute(payload) {
    const task = () =>
      new Promise((resolve, reject) => {
        if (this.dead) return reject(new Error('Conexión SQL no disponible'));
        const timer = setTimeout(() => {
          this.process.kill();
          reject(new Error('Tiempo de conexión SQL agotado'));
        }, 25000);
        this.pending = {
          resolve: (r) => {
            clearTimeout(timer);
            resolve(r);
          },
          reject: (e) => {
            clearTimeout(timer);
            reject(e);
          },
        };
        this.process.stdin.write(JSON.stringify(payload) + '\n');
      });
    const result = this.queue.then(task);
    this.queue = result.catch(() => {});
    return result;
  }
  async close() {
    this.process.stdin.end();
  }
}
let connection;
export async function pool() {
  if (ambient.getStore()) return ambient.getStore();
  if (!connection || connection.dead) connection = new Connection();
  return connection;
}
export async function query(db, text, params = {}) {
  return db.execute({ action: 'query', text, params });
}
export async function transaction(work) {
  const inherited = ambient.getStore();
  if (inherited) return work(inherited);
  const db = new Connection();
  try {
    await db.execute({ action: 'begin' });
    const result = await ambient.run(db, () => work(db));
    await db.execute({ action: 'commit' });
    return result;
  } catch (e) {
    try {
      await db.execute({ action: 'rollback' });
    } catch (rollbackError) {
      console.error('No se pudo revertir la transacción:', rollbackError.message);
    }
    throw e;
  } finally {
    await db.close();
  }
}
export async function rollbackTest(work) {
  const db = new Connection();
  try {
    await db.execute({ action: 'begin' });
    return await ambient.run(db, () => work(db));
  } finally {
    try {
      await db.execute({ action: 'rollback' });
    } finally {
      await db.close();
    }
  }
}
export async function close() {
  if (connection) await connection.close();
  connection = undefined;
}
