import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

import { env } from '../config/env.js';
import { AppError } from './errors.js';

const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;

function deriveKey(secret: string) {
  return createHash('sha256').update(secret).digest();
}

const encryptionKey = deriveKey(env.APP_ENCRYPTION_KEY);

export function encryptSecret(value: string) {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ENCRYPTION_ALGORITHM, encryptionKey, iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [iv.toString('base64'), tag.toString('base64'), encrypted.toString('base64')].join(':');
}

export function decryptSecret(value: string) {
  const [ivEncoded, tagEncoded, encryptedEncoded] = value.split(':');

  if (!ivEncoded || !tagEncoded || !encryptedEncoded) {
    throw new AppError(500, 'Stored secret is malformed', 'MALFORMED_SECRET');
  }

  const decipher = createDecipheriv(
    ENCRYPTION_ALGORITHM,
    encryptionKey,
    Buffer.from(ivEncoded, 'base64')
  );

  decipher.setAuthTag(Buffer.from(tagEncoded, 'base64'));

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedEncoded, 'base64')),
    decipher.final()
  ]).toString('utf8');
}

export function encryptJson(value: unknown) {
  return encryptSecret(JSON.stringify(value));
}

export function decryptJson<T>(value: string) {
  return JSON.parse(decryptSecret(value)) as T;
}

export function maskSecret(value: string) {
  if (!value) {
    return null;
  }

  const visible = value.slice(-4);
  return `${'*'.repeat(Math.max(8, value.length - 4))}${visible}`;
}
