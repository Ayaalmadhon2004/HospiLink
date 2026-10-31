// Server-side session revocation: logout stores the token's `jti` until the token would have expired anyway.
import jwt from 'jsonwebtoken';
import prisma from '../config/db';
import { JWT_SECRET } from '../config/jwt';

/** True when this jti was revoked. Tokens without a jti (issued before revocation existed) are never revoked. */
export const isTokenRevoked = async (jti: unknown): Promise<boolean> => {
  if (typeof jti !== 'string' || !jti) return false;
  const row = await prisma.revokedToken.findUnique({ where: { jti }, select: { jti: true } });
  return Boolean(row);
};

/**
 * Revokes the presented session token (idempotent). Invalid, expired or jti-less tokens are ignored: they are
 * either dead already or cannot be tracked. Expired rows are purged here, so no timer is needed.
 */
export const revokeSessionToken = async (token: string | undefined): Promise<void> => {
  if (!token) return;
  let decoded: jwt.JwtPayload & { userId?: unknown; purpose?: unknown };
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (typeof payload === 'string') return;
    decoded = payload;
  } catch {
    return;
  }
  if (typeof decoded.jti !== 'string' || typeof decoded.exp !== 'number' || typeof decoded.userId !== 'string' || decoded.purpose) return;

  await prisma.revokedToken.createMany({
    data: [{ jti: decoded.jti, expiresAt: new Date(decoded.exp * 1000) }],
    skipDuplicates: true,
  });
  await prisma.revokedToken.deleteMany({ where: { expiresAt: { lt: new Date() } } });
};
