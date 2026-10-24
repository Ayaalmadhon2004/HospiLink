// backend/src/services/staffLink.ts
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import prisma from '../config/db';
import logger from '../config/logger';
import { issueAuthToken } from './authTokens';
import { sendMail, appLink } from './mailer';

const SETUP_LINK_TTL_MS = 3 * 24 * 60 * 60 * 1000; // 3 days

/**
 * One-time convenience when a login is created or approved: attach it to the not-yet-linked Staff record of the
 * SAME hospital with the same email. After this the link is the FK (Staff.userId); emails are never matched again.
 * Never throws (the caller's main action must not fail because of this).
 */
export const linkStaffToUserByEmail = async (user: { id: string; email: string; hospitalId: string }): Promise<boolean> => {
  try {
    const staff = await prisma.staff.findFirst({
      where: { hospitalId: user.hospitalId, userId: null, email: { equals: user.email, mode: 'insensitive' } },
      select: { id: true },
    });
    if (!staff) return false;
    await prisma.staff.update({ where: { id: staff.id }, data: { userId: user.id } });
    return true;
  } catch (err) {
    logger.error({ err, userId: user.id }, 'Linking staff to the new login failed');
    return false;
  }
};

/** Unusable random password: the new user chooses theirs through the emailed set-password link. */
export const randomPasswordHash = (): Promise<string> => bcrypt.hash(crypto.randomBytes(32).toString('hex'), 12);

/** Emails a set-password link (reuses the password-reset flow). Fire-and-forget: failures are logged. */
export const sendSetPasswordMail = (userId: string, email: string): void => {
  void issueAuthToken(userId, 'PASSWORD_RESET', SETUP_LINK_TTL_MS)
    .then((token) =>
      sendMail(
        email,
        'Your HospiLink account',
        `An account was created for you on HospiLink. Choose your password within 3 days:\n${appLink('/reset-password', token)}`,
      ),
    )
    .catch((err: unknown) => logger.error({ err }, 'Set-password mail failed'));
};
