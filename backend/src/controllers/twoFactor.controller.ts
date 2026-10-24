// backend/src/controllers/twoFactor.controller.ts
import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { authenticator } from 'otplib';
import prisma from '../config/db';
import logger from '../config/logger';
import { JWT_SECRET } from '../config/jwt';
import { encryptSecret } from '../config/twoFactor';
import {
  twoFactorLoginSchema,
  twoFactorEnableSchema,
  twoFactorDisableSchema,
  twoFactorRegenerateSchema,
  formatZodError,
} from '../validators/auth.validator';
import { completeLogin } from './auth.controller';
import { sendSecurityNotice } from '../services/securityNotices';
import {
  verifySecondFactor,
  verifyTotp,
  generateRecoveryCodes,
  type SecondFactorResult,
} from '../services/twoFactor';

const ISSUER = 'HospiLink';

const respondFactorFailure = (res: Response, result: Exclude<SecondFactorResult, 'ok'>): void => {
  if (result === 'locked') {
    res.status(429).json({
      success: false,
      message: 'Too many failed attempts. Try again in a few minutes.',
      code: 'TWO_FACTOR_LOCKED',
    });
    return;
  }
  res.status(401).json({ success: false, message: 'Invalid verification code' });
};

// ============================================
// POST /api/auth/2fa/login — second step of login
// ============================================
export const twoFactorLogin = async (req: Request, res: Response) => {
  try {
    const parsed = twoFactorLoginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, message: formatZodError(parsed.error) });
      return;
    }
    const { challengeToken, code, recoveryCode } = parsed.data;

    let uid: string;
    let rememberMe: boolean;
    try {
      const decoded = jwt.verify(challengeToken, JWT_SECRET) as { uid?: unknown; purpose?: unknown; rememberMe?: unknown };
      if (decoded.purpose !== '2fa' || typeof decoded.uid !== 'string') throw new Error('wrong purpose');
      uid = decoded.uid;
      rememberMe = decoded.rememberMe === true;
    } catch {
      res.status(401).json({ success: false, message: 'Login session expired, please sign in again' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: uid },
      include: { hospital: { select: { id: true, name: true, location: true } } },
    });
    // Same gates as the password step: the account may have changed since the challenge was issued.
    if (!user || !user.twoFactorEnabledAt || user.accountStatus !== 'ACTIVE' || !user.emailVerifiedAt) {
      res.status(401).json({ success: false, message: 'Login session expired, please sign in again' });
      return;
    }

    const result = await verifySecondFactor(user, { code, recoveryCode });
    if (result !== 'ok') {
      respondFactorFailure(res, result);
      return;
    }

    if (recoveryCode) {
      const remaining = await prisma.twoFactorRecoveryCode.count({ where: { userId: user.id, usedAt: null } });
      sendSecurityNotice(
        user.email,
        'A recovery code was used to sign in',
        `A two-factor recovery code was just used to sign in to your HospiLink account. Recovery codes left: ${remaining}.`,
      );
    }

    completeLogin(res, user, rememberMe);
  } catch (error: unknown) {
    logger.error({ err: error }, 'TwoFactorLogin error:');
    res.status(500).json({ success: false, message: 'Login failed' });
  }
};

// ============================================
// POST /api/auth/2fa/setup — creates a pending secret (not active until /enable)
// ============================================
export const twoFactorSetup = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Not authenticated' });
      return;
    }
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, twoFactorEnabledAt: true },
    });
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }
    if (user.twoFactorEnabledAt) {
      res.status(409).json({ success: false, message: 'Two-factor authentication is already enabled' });
      return;
    }

    const secret = authenticator.generateSecret();
    await prisma.user.update({
      where: { id: userId },
      data: { twoFactorSecretEnc: encryptSecret(secret), twoFactorLastStep: null },
    });

    res.status(200).json({
      success: true,
      data: { secret, otpauthUrl: authenticator.keyuri(user.email, ISSUER, secret) },
    });
  } catch (error: unknown) {
    logger.error({ err: error }, 'TwoFactorSetup error:');
    res.status(500).json({ success: false, message: 'Failed to start two-factor setup' });
  }
};

// ============================================
// POST /api/auth/2fa/enable — { code }; returns the recovery codes once
// ============================================
export const twoFactorEnable = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Not authenticated' });
      return;
    }
    const parsed = twoFactorEnableSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, message: formatZodError(parsed.error) });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, twoFactorSecretEnc: true, twoFactorLastStep: true, twoFactorEnabledAt: true },
    });
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }
    if (user.twoFactorEnabledAt) {
      res.status(409).json({ success: false, message: 'Two-factor authentication is already enabled' });
      return;
    }
    if (!user.twoFactorSecretEnc) {
      res.status(400).json({ success: false, message: 'Start the setup first' });
      return;
    }
    if (!(await verifyTotp(user, parsed.data.code))) {
      res.status(400).json({ success: false, message: 'Invalid verification code' });
      return;
    }

    const { plain, hashes } = generateRecoveryCodes();
    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { twoFactorEnabledAt: new Date(), twoFactorFailures: 0, twoFactorLockedUntil: null },
      }),
      prisma.twoFactorRecoveryCode.deleteMany({ where: { userId } }),
      prisma.twoFactorRecoveryCode.createMany({ data: hashes.map((codeHash) => ({ userId, codeHash })) }),
    ]);

    sendSecurityNotice(user.email, 'Two-factor authentication enabled', 'Two-factor authentication was turned on for your HospiLink account.');

    res.status(200).json({ success: true, data: { recoveryCodes: plain } });
  } catch (error: unknown) {
    logger.error({ err: error }, 'TwoFactorEnable error:');
    res.status(500).json({ success: false, message: 'Failed to enable two-factor authentication' });
  }
};

// Password + second factor, required for the sensitive actions below. Answers the request itself on
// failure (and returns null); on success returns the full user row.
const confirmIdentity = async (req: Request, res: Response, schema: typeof twoFactorDisableSchema) => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ success: false, message: 'Not authenticated' });
    return null;
  }
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, message: formatZodError(parsed.error) });
    return null;
  }
  const { password, code, recoveryCode } = parsed.data;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    res.status(404).json({ success: false, message: 'User not found' });
    return null;
  }
  if (!user.twoFactorEnabledAt) {
    res.status(409).json({ success: false, message: 'Two-factor authentication is not enabled' });
    return null;
  }
  if (!(await bcrypt.compare(password, user.password))) {
    res.status(400).json({ success: false, message: 'Current password is incorrect' });
    return null;
  }
  const result = await verifySecondFactor(user, { code, recoveryCode });
  if (result !== 'ok') {
    respondFactorFailure(res, result);
    return null;
  }
  return user;
};

// ============================================
// POST /api/auth/2fa/disable — { password, code | recoveryCode }
// ============================================
export const twoFactorDisable = async (req: Request, res: Response) => {
  try {
    const user = await confirmIdentity(req, res, twoFactorDisableSchema);
    if (!user) return;

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: {
          twoFactorSecretEnc: null,
          twoFactorEnabledAt: null,
          twoFactorLastStep: null,
          twoFactorFailures: 0,
          twoFactorLockedUntil: null,
        },
      }),
      prisma.twoFactorRecoveryCode.deleteMany({ where: { userId: user.id } }),
    ]);

    sendSecurityNotice(user.email, 'Two-factor authentication disabled', 'Two-factor authentication was turned off for your HospiLink account.');

    res.status(200).json({ success: true, message: 'Two-factor authentication disabled' });
  } catch (error: unknown) {
    logger.error({ err: error }, 'TwoFactorDisable error:');
    res.status(500).json({ success: false, message: 'Failed to disable two-factor authentication' });
  }
};

// ============================================
// POST /api/auth/2fa/recovery-codes — { password, code | recoveryCode }; replaces all codes, returns the new ones once
// ============================================
export const twoFactorRegenerateRecoveryCodes = async (req: Request, res: Response) => {
  try {
    const user = await confirmIdentity(req, res, twoFactorRegenerateSchema);
    if (!user) return;

    const { plain, hashes } = generateRecoveryCodes();
    await prisma.$transaction([
      prisma.twoFactorRecoveryCode.deleteMany({ where: { userId: user.id } }),
      prisma.twoFactorRecoveryCode.createMany({ data: hashes.map((codeHash) => ({ userId: user.id, codeHash })) }),
    ]);

    sendSecurityNotice(
      user.email,
      'Recovery codes regenerated',
      'The two-factor recovery codes of your HospiLink account were regenerated. The old codes no longer work.',
    );

    res.status(200).json({ success: true, data: { recoveryCodes: plain } });
  } catch (error: unknown) {
    logger.error({ err: error }, 'TwoFactorRegenerate error:');
    res.status(500).json({ success: false, message: 'Failed to regenerate recovery codes' });
  }
};
