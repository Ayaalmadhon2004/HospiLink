// backend/src/controllers/auth.controller.ts
import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import prisma from '../config/db';
import { JWT_SECRET, SESSION_TTL } from '../config/jwt';
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyEmailSchema,
  resendVerificationSchema,
  changePasswordSchema,
  formatZodError,
} from '../validators/auth.validator';
import { issueAuthToken, consumeAuthToken } from '../services/authTokens';
import { revokeSessionToken } from '../services/revokedTokens';
import { sendMail, appLink } from '../services/mailer';
import logger from '../config/logger';
import { authCookieOptions, clearCookieOptions } from '../config/cookies';

// Public signup creates a PENDING account with the lowest-privilege role as a placeholder
// (the Prisma Role enum has no STAFF value). The account cannot log in or call any protected
// route until an ADMIN approves it and assigns the real role (users.controller).
const PUBLIC_SIGNUP_ROLE = 'NURSE' as const;

const RESET_TTL_MS = 60 * 60 * 1000; // 1h
const VERIFY_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const GENERIC_MAIL_MESSAGE = 'If an account exists for this email, we have sent a message.';

// Fire-and-forget: the HTTP response time must not reveal whether the mail was sent.
const sendVerificationMail = (userId: string, email: string): void => {
  void issueAuthToken(userId, 'EMAIL_VERIFY', VERIFY_TTL_MS)
    .then((token) =>
      sendMail(
        email,
        'Verify your HospiLink email',
        `Confirm your email address within 24 hours:\n${appLink('/verify-email', token)}`,
      ),
    )
    .catch((err: unknown) => logger.error({ err }, 'Verification mail failed'));
};

// ============================================
// Generate JWT Token
// ============================================
export const generateToken = (user: { id: string; email: string; role: string }, ttl: { jwt: string }): string => {
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      role: user.role,
    },
    JWT_SECRET,
    { expiresIn: ttl.jwt as jwt.SignOptions['expiresIn'], jwtid: randomUUID() }
  );
};

// Fields that must never leave the server.
interface SensitiveUserFields {
  password?: unknown;
  passwordChangedAt?: unknown;
  twoFactorSecretEnc?: unknown;
  twoFactorEnabledAt?: Date | null;
  twoFactorLastStep?: unknown;
  twoFactorFailures?: unknown;
  twoFactorLockedUntil?: unknown;
}

export const toPublicUser = <T extends object>(user: T & SensitiveUserFields) => {
  const {
    password: _password,
    passwordChangedAt: _passwordChangedAt,
    twoFactorSecretEnc: _secret,
    twoFactorEnabledAt,
    twoFactorLastStep: _lastStep,
    twoFactorFailures: _failures,
    twoFactorLockedUntil: _lockedUntil,
    ...safe
  } = user;
  return { ...safe, twoFactorEnabled: Boolean(twoFactorEnabledAt) };
};

// Sets the session cookie and answers 200. Shared by the password step and the 2FA step of login.
export const completeLogin = (
  res: Response,
  user: { id: string; email: string; role: string } & SensitiveUserFields,
  rememberMe: boolean,
): void => {
  const ttl = rememberMe ? SESSION_TTL.remember : SESSION_TTL.default;
  const token = generateToken({ id: user.id, email: user.email, role: user.role }, ttl);
  res.cookie('token', token, authCookieOptions(ttl.cookieMs));
  const publicUser = toPublicUser(user);
  // The JWT only travels in the httpOnly cookie (never in the body); `user` at the top level is a deprecated duplicate of `data.user`.
  res.status(200).json({ success: true, message: 'Login successful', data: { user: publicUser }, user: publicUser });
};

// ============================================
// REGISTER
// ============================================
export const register = async (req: Request, res: Response) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, message: formatZodError(parsed.error) });
      return;
    }
    // role / hospitalId from the body are intentionally ignored.
    const { email, password, name, department, shift, hospitalCode } = parsed.data;

    // The hospital comes from its signup code, never from a client-supplied id.
    const hospital = await prisma.hospital.findUnique({ where: { code: hospitalCode }, select: { id: true } });
    if (!hospital) {
      res.status(400).json({ success: false, message: 'Invalid hospital code' });
      return;
    }
    const hospitalId = hospital.id;

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      res.status(400).json({
        success: false,
        message: 'User already exists with this email',
      });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role: PUBLIC_SIGNUP_ROLE,
        accountStatus: 'PENDING',
        department,
        shift,
        hospitalId,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        department: true,
        shift: true,
        status: true,
        accountStatus: true,
        hospitalId: true,
        createdAt: true,
      },
    });

    sendVerificationMail(user.id, user.email);

    // No token/cookie: the user is not signed in until an admin approves the account.
    res.status(201).json({
      success: true,
      message: 'Registration received. Check your email to verify your address; your account is also pending admin approval.',
      data: { user },
      user, // deprecated: use data.user
    });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Register error:');
    res.status(500).json({
      success: false,
      message: 'Registration failed',
    });
  }
};

// ============================================
// LOGIN
// ============================================
export const login = async (req: Request, res: Response) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: 'Email and password are required: ' + formatZodError(parsed.error),
      });
      return;
    }
    const { email, password, rememberMe } = parsed.data;
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        hospital: {
          select: {
            id: true,
            name: true,
            location: true,
          },
        },
      },
    });

    if (!user) {
      res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
      return;
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
      return;
    }

    // Checked after the password so the status of an account is not revealed without credentials.
    if (user.accountStatus !== 'ACTIVE') {
      const pending = user.accountStatus === 'PENDING';
      const message = pending ? 'Account pending admin approval' : 'Account is disabled';
      res.status(403).json({
        success: false,
        message,
        code: pending ? 'ACCOUNT_PENDING' : 'ACCOUNT_DISABLED',
      });
      return;
    }

    if (!user.emailVerifiedAt) {
      res.status(403).json({
        success: false,
        message: 'Please verify your email address',
        code: 'EMAIL_NOT_VERIFIED',
      });
      return;
    }

    if (user.twoFactorEnabledAt) {
      // No cookie yet: the challenge only proves the password was right, lives 5 minutes and is
      // rejected by protect/socketAuth (no userId claim). POST /auth/2fa/login finishes the login.
      const challengeToken = jwt.sign({ uid: user.id, purpose: '2fa', rememberMe }, JWT_SECRET, { expiresIn: '5m' });
      res.status(200).json({ success: true, data: { twoFactorRequired: true, challengeToken }, twoFactorRequired: true, challengeToken });
      return;
    }

    completeLogin(res, user, rememberMe);
  } catch (error: unknown) {
    logger.error({ err: error }, 'Login error:');
    res.status(500).json({
      success: false,
      message: 'Login failed',
    });
  }
};

// ============================================
// LOGOUT
// ============================================
export const logout = async (req: Request, res: Response) => {
  try {
    const raw = req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.split(' ')[1] : req.cookies?.token;
    // Revoke the presented token server-side; a storage failure must not leave the user signed in on this device.
    await revokeSessionToken(raw).catch((err: unknown) => logger.error({ err }, 'Token revocation failed'));
    res.clearCookie('token', clearCookieOptions());

    res.status(200).json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Logout error:');
    res.status(500).json({
      success: false,
      message: 'Logout failed',
    });
  }
};

// ============================================
// GET CURRENT USER (ME)
// ============================================
export const getMe = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'Not authenticated',
      });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        department: true,
        shift: true,
        status: true,
        hospitalId: true,
        hospital: {
          select: {
            id: true,
            name: true,
            location: true,
          },
        },
        createdAt: true,
      },
    });

    if (!user) {
      res.status(404).json({
        success: false,
        code: 'USER_NOT_FOUND', message: 'User not found',
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: { user },
      user, // deprecated: use data.user
    });
  } catch (error: unknown) {
    logger.error({ err: error }, 'GetMe error:');
    res.status(500).json({
      success: false,
      message: 'Failed to get user',
    });
  }
};

// ============================================
// UPDATE PASSWORD
// ============================================
// Whether the caller's current token was issued with "remember me" (so the re-issued one keeps its lifetime).
const isRememberedSession = (req: Request): boolean => {
  const raw = req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.split(' ')[1] : req.cookies?.token;
  const decoded = raw ? jwt.decode(raw) : null;
  if (!decoded || typeof decoded === 'string' || !decoded.iat || !decoded.exp) return false;
  return decoded.exp - decoded.iat > 24 * 60 * 60;
};

export const updatePassword = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'Not authenticated',
      });
      return;
    }

    const parsed = changePasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, message: formatZodError(parsed.error) });
      return;
    }
    const { currentPassword, newPassword } = parsed.data;

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      res.status(404).json({
        success: false,
        code: 'USER_NOT_FOUND', message: 'User not found',
      });
      return;
    }

    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid) {
      res.status(400).json({
        success: false,
        message: 'Current password is incorrect',
      });
      return;
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await prisma.user.update({
      where: { id: userId },
      // passwordChangedAt revokes every other session (see protect / socketAuth).
      data: { password: hashedPassword, passwordChangedAt: new Date() },
    });

    // Keep this device signed in with a fresh token.
    const ttl = isRememberedSession(req) ? SESSION_TTL.remember : SESSION_TTL.default;
    res.cookie('token', generateToken({ id: user.id, email: user.email, role: user.role }, ttl), authCookieOptions(ttl.cookieMs));

    res.status(200).json({
      success: true,
      message: 'Password updated successfully',
    });
  } catch (error: unknown) {
    logger.error({ err: error }, 'UpdatePassword error:');
    res.status(500).json({
      success: false,
      message: 'Failed to update password',
    });
  }
};

// ============================================
// FORGOT / RESET PASSWORD
// ============================================
export const forgotPassword = async (req: Request, res: Response) => {
  try {
    const parsed = forgotPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, message: formatZodError(parsed.error) });
      return;
    }
    const user = await prisma.user.findUnique({
      where: { email: parsed.data.email },
      select: { id: true, email: true, accountStatus: true },
    });
    if (user && user.accountStatus !== 'DISABLED') {
      void issueAuthToken(user.id, 'PASSWORD_RESET', RESET_TTL_MS)
        .then((token) =>
          sendMail(
            user.email,
            'Reset your HospiLink password',
            `Use this link within 1 hour to choose a new password:\n${appLink('/reset-password', token)}\n\nIf you did not ask for this, ignore this email.`,
          ),
        )
        .catch((err: unknown) => logger.error({ err }, 'Password reset mail failed'));
    }
    // Same answer whether or not the account exists (no user enumeration).
    res.status(200).json({ success: true, message: GENERIC_MAIL_MESSAGE });
  } catch (error: unknown) {
    logger.error({ err: error }, 'ForgotPassword error:');
    res.status(500).json({ success: false, message: 'Request failed' });
  }
};

export const resetPassword = async (req: Request, res: Response) => {
  try {
    const parsed = resetPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, message: formatZodError(parsed.error) });
      return;
    }
    const userId = await consumeAuthToken(parsed.data.token, 'PASSWORD_RESET');
    if (!userId) {
      res.status(400).json({ success: false, message: 'Invalid or expired link' });
      return;
    }
    const now = new Date();
    await prisma.user.update({
      where: { id: userId },
      data: {
        password: await bcrypt.hash(parsed.data.password, 12),
        passwordChangedAt: now, // revokes every existing session
        emailVerifiedAt: now, // opening the emailed link proves mailbox ownership
      },
    });
    // No auto-login: the user signs in with the new password.
    res.status(200).json({ success: true, message: 'Password updated. You can sign in now.' });
  } catch (error: unknown) {
    logger.error({ err: error }, 'ResetPassword error:');
    res.status(500).json({ success: false, message: 'Request failed' });
  }
};

// ============================================
// EMAIL VERIFICATION
// ============================================
export const verifyEmail = async (req: Request, res: Response) => {
  try {
    const parsed = verifyEmailSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, message: formatZodError(parsed.error) });
      return;
    }
    const userId = await consumeAuthToken(parsed.data.token, 'EMAIL_VERIFY');
    if (!userId) {
      res.status(400).json({ success: false, message: 'Invalid or expired link' });
      return;
    }
    await prisma.user.update({ where: { id: userId }, data: { emailVerifiedAt: new Date() } });
    res.status(200).json({ success: true, message: 'Email verified. You can sign in once your account is approved.' });
  } catch (error: unknown) {
    logger.error({ err: error }, 'VerifyEmail error:');
    res.status(500).json({ success: false, message: 'Request failed' });
  }
};

export const resendVerification = async (req: Request, res: Response) => {
  try {
    const parsed = resendVerificationSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, message: formatZodError(parsed.error) });
      return;
    }
    const user = await prisma.user.findUnique({
      where: { email: parsed.data.email },
      select: { id: true, email: true, emailVerifiedAt: true },
    });
    if (user && !user.emailVerifiedAt) sendVerificationMail(user.id, user.email);
    res.status(200).json({ success: true, message: GENERIC_MAIL_MESSAGE });
  } catch (error: unknown) {
    logger.error({ err: error }, 'ResendVerification error:');
    res.status(500).json({ success: false, message: 'Request failed' });
  }
};
