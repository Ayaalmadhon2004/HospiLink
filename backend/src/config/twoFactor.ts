// backend/src/config/twoFactor.ts
import crypto from 'node:crypto';

// 32 random bytes, base64 (generate with: openssl rand -base64 32).
// Read lazily so the API still boots without it; only the 2FA endpoints fail until it is set.
const key = (): Buffer => {
  const k = Buffer.from(process.env.TWO_FACTOR_ENC_KEY ?? '', 'base64');
  if (k.length !== 32) throw new Error('TWO_FACTOR_ENC_KEY must be 32 bytes, base64 encoded');
  return k;
};

/** AES-256-GCM: returns `iv:tag:ciphertext` (base64url). */
export const encryptSecret = (plain: string): string => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), ciphertext].map((b) => b.toString('base64url')).join(':');
};

export const decryptSecret = (stored: string): string => {
  const parts = stored.split(':');
  if (parts.length !== 3) throw new Error('Malformed encrypted secret');
  const [iv, tag, ciphertext] = parts.map((p) => Buffer.from(p, 'base64url'));
  const decipher = crypto.createDecipheriv('aes-256-gcm', key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
};
