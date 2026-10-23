// backend/src/services/twoFactor.ts
import crypto from 'node:crypto';
import { authenticator } from 'otplib';
import prisma from '../config/db';
import { decryptSecret } from '../config/twoFactor';

authenticator.options = { window: 1 }; // accepts the previous/next 30s code (clock drift)

const STEP_MS = 30_000;
export const MAX_FAILURES = 5;
export const LOCK_MS = 15 * 60 * 1000;
export const RECOVERY_CODE_COUNT = 10;

export interface TwoFactorUser {
  id: string;
  twoFactorSecretEnc: string | null;
  twoFactorLastStep: number | null;
  twoFactorLockedUntil: Date | null;
}

export type SecondFactorResult = 'ok' | 'invalid' | 'locked';

const sha256 = (v: string): string => crypto.createHash('sha256').update(v).digest('hex');
const normalizeRecoveryCode = (v: string): string => v.replace(/-/g, '').toLowerCase();

/** Accepts a valid code once: the time-step is burned atomically so the same code cannot be replayed. */
export const verifyTotp = async (user: Omit<TwoFactorUser, 'twoFactorLockedUntil'>, code: string): Promise<boolean> => {
  if (!user.twoFactorSecretEnc) return false;
  const delta = authenticator.checkDelta(code, decryptSecret(user.twoFactorSecretEnc));
  if (delta === null) return false;
  const step = Math.floor(Date.now() / STEP_MS) + delta;
  const { count } = await prisma.user.updateMany({
    where: { id: user.id, OR: [{ twoFactorLastStep: null }, { twoFactorLastStep: { lt: step } }] },
    data: { twoFactorLastStep: step },
  });
  return count === 1;
};

const useRecoveryCode = async (userId: string, code: string): Promise<boolean> => {
  const { count } = await prisma.twoFactorRecoveryCode.updateMany({
    where: { userId, codeHash: sha256(normalizeRecoveryCode(code)), usedAt: null },
    data: { usedAt: new Date() },
  });
  return count === 1;
};

/** Generates the plain codes (shown once) and the rows to store (hashes only). */
export const generateRecoveryCodes = (): { plain: string[]; hashes: string[] } => {
  const plain = Array.from({ length: RECOVERY_CODE_COUNT }, () => {
    const hex = crypto.randomBytes(5).toString('hex');
    return `${hex.slice(0, 5)}-${hex.slice(5)}`;
  });
  return { plain, hashes: plain.map((c) => sha256(normalizeRecoveryCode(c))) };
};

/**
 * Checks a TOTP code or a recovery code, with a per-account lockout
 * (MAX_FAILURES wrong attempts => locked for LOCK_MS) against distributed brute force.
 */
export const verifySecondFactor = async (
  user: TwoFactorUser,
  input: { code?: string; recoveryCode?: string },
): Promise<SecondFactorResult> => {
  if (user.twoFactorLockedUntil && user.twoFactorLockedUntil > new Date()) return 'locked';

  let ok = false;
  if (input.code) ok = await verifyTotp(user, input.code);
  else if (input.recoveryCode) ok = await useRecoveryCode(user.id, input.recoveryCode);

  if (ok) {
    await prisma.user.update({ where: { id: user.id }, data: { twoFactorFailures: 0, twoFactorLockedUntil: null } });
    return 'ok';
  }

  const { twoFactorFailures } = await prisma.user.update({
    where: { id: user.id },
    data: { twoFactorFailures: { increment: 1 } },
    select: { twoFactorFailures: true },
  });
  if (twoFactorFailures >= MAX_FAILURES) {
    await prisma.user.update({
      where: { id: user.id },
      data: { twoFactorFailures: 0, twoFactorLockedUntil: new Date(Date.now() + LOCK_MS) },
    });
    return 'locked';
  }
  return 'invalid';
};
