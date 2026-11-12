import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scrypt,
  timingSafeEqual,
} from 'node:crypto';
import { promisify } from 'node:util';
import { BusinessError } from '../shared/errors.mjs';

const deriveKey = promisify(scrypt);
const options = { N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 };

export const createPassword = () => randomBytes(18).toString('base64url');

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const key = await deriveKey(password, salt, 32, options);
  return `scrypt$131072$8$1$${salt.toString('base64url')}$${key.toString('base64url')}`;
}

export async function verifyPassword(password, stored) {
  const [algorithm, cost, blockSize, parallel, salt, digest] = stored.split('$');
  if (algorithm !== 'scrypt' || cost !== '131072' || blockSize !== '8' || parallel !== '1')
    return false;
  const expected = Buffer.from(digest || '', 'base64url');
  if (expected.length !== 32) return false;
  const actual = await deriveKey(password, Buffer.from(salt, 'base64url'), 32, options);
  return timingSafeEqual(actual, expected);
}

function encryptionKey() {
  const value = (process.env.CREDENTIALS_ENCRYPTION_KEY || '').trim();
  if (!/^[A-Za-z0-9+/]{43}=$/.test(value))
    throw new BusinessError(
      'Configura CREDENTIALS_ENCRYPTION_KEY antes de crear las credenciales.',
    );
  return Buffer.from(value, 'base64');
}

// El hash autentica la clave. Este cifrado solo conserva el mensaje hasta confirmar su entrega.
export function sealMessage(text, contractId) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  cipher.setAAD(Buffer.from(String(contractId)));
  const payload = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), payload].map((part) => part.toString('base64url')).join('.');
}

export function openMessage(payload, contractId) {
  const [iv, tag, encrypted] = payload.split('.').map((part) => Buffer.from(part, 'base64url'));
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), iv);
  decipher.setAAD(Buffer.from(String(contractId)));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}
