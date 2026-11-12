// Locks a short private text (national ID, KRA PIN) before it goes into the database, and unlocks it again.
// AES-256-GCM: the text cannot be read or changed without the key. Each value gets its own random start.
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { config } from '../config/env.js';

const PREFIX = 'enc1:';

export const isEncrypted = (v) => typeof v === 'string' && v.startsWith(PREFIX);

export function encryptText(plain) {
  if (plain === null || plain === undefined || plain === '') return plain ?? null;
  if (isEncrypted(plain)) return plain;
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', config.dataKey, iv);
  const body = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  return PREFIX + [iv, cipher.getAuthTag(), body].map((b) => b.toString('base64url')).join('.');
}

// A value saved before encryption existed is returned as it is.
export function decryptText(stored) {
  if (!isEncrypted(stored)) return stored ?? null;
  const [iv, tag, body] = stored.slice(PREFIX.length).split('.').map((p) => Buffer.from(p, 'base64url'));
  const decipher = createDecipheriv('aes-256-gcm', config.dataKey, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(body), decipher.final()]).toString('utf8');
}
