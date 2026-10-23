// backend/src/services/authTokens.ts
import crypto from 'node:crypto';
import type { AuthTokenType } from '@prisma/client';
import prisma from '../config/db';

const sha256 = (value: string): string => crypto.createHash('sha256').update(value).digest('hex');

/** Creates a single-use token (only its hash is stored) and invalidates older ones of the same type. */
export const issueAuthToken = async (userId: string, type: AuthTokenType, ttlMs: number): Promise<string> => {
  const token = crypto.randomBytes(32).toString('base64url');
  await prisma.authToken.updateMany({ where: { userId, type, usedAt: null }, data: { usedAt: new Date() } });
  await prisma.authToken.create({
    data: { userId, type, tokenHash: sha256(token), expiresAt: new Date(Date.now() + ttlMs) },
  });
  return token;
};

/** Returns the userId when the token is valid, unused and unexpired, and marks it used atomically. */
export const consumeAuthToken = async (token: string, type: AuthTokenType): Promise<string | null> => {
  const row = await prisma.authToken.findUnique({ where: { tokenHash: sha256(token) } });
  if (!row || row.type !== type || row.usedAt || row.expiresAt < new Date()) return null;
  const { count } = await prisma.authToken.updateMany({
    where: { id: row.id, usedAt: null },
    data: { usedAt: new Date() },
  });
  return count === 1 ? row.userId : null;
};
