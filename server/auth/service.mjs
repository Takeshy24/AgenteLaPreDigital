import { createHash, randomBytes } from 'node:crypto';
import { pool } from '../db.mjs';
import { verifyPassword } from '../access/crypto.mjs';
import { BusinessError } from '../shared/errors.mjs';
import { findAdmin } from './repository.mjs';

export const SESSION_DURATION = 8 * 60 * 60 * 1000;
const sessions = new Map();
const digest = (token) => createHash('sha256').update(token).digest('hex');

export async function authenticate(username, password) {
  const user = await findAdmin(await pool(), username);
  if (user?.missing)
    throw new BusinessError('Falta preparar el acceso. Ejecuta npm run migrate.', 503);
  if (!user || !(await verifyPassword(password, user.passwordHash)))
    throw new BusinessError('Usuario o contraseña incorrectos.', 401);
  return { id: user.id, username: user.username };
}
export function createSession(user, previousToken = null, now = Date.now()) {
  endSession(previousToken);
  for (const [key, session] of sessions) if (session.expiresAt <= now) sessions.delete(key);
  if (sessions.size >= 128) sessions.delete(sessions.keys().next().value);
  const token = randomBytes(32).toString('base64url');
  sessions.set(digest(token), { user, expiresAt: now + SESSION_DURATION });
  return token;
}
export function sessionUser(token, now = Date.now()) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token ?? '')) return null;
  const key = digest(token);
  const session = sessions.get(key);
  if (!session) return null;
  if (session.expiresAt <= now) {
    sessions.delete(key);
    return null;
  }
  return session.user;
}
export function endSession(token) {
  if (typeof token === 'string') sessions.delete(digest(token));
}
