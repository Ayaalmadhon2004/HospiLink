// backend/src/controllers/users.controller.ts
//
// Account administration (ADMIN only, enforced in users.routes.ts). Everything is scoped to the
// admin's own hospital: an admin can neither see nor activate users of another hospital.
import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../config/db';
import logger from '../config/logger';
import { hospitalIdOf } from '../utils/tenant';
import { linkStaffToUserByEmail } from '../services/staffLink';
import { isSerializationFailure } from '../utils/dbErrors';
import { sendSecurityNotice } from '../services/securityNotices';
import type { Prisma, Role } from '@prisma/client';

const USER_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  department: true,
  shift: true,
  accountStatus: true,
  hospitalId: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

class LastAdminError extends Error {}

const handleError = (res: Response, error: unknown, message: string) => {
  logger.error({ err: error }, `[Users] ${message}:`);
  res.status(500).json({ success: false, message });
};

// GET /api/users?accountStatus=PENDING
export const listUsers = async (req: Request, res: Response) => {
  try {
    const { accountStatus, linkable } = req.query as { accountStatus?: 'PENDING' | 'ACTIVE' | 'DISABLED'; linkable?: 'true' };
    const users = await prisma.user.findMany({
      where: {
        hospitalId: hospitalIdOf(req),
        ...(accountStatus ? { accountStatus } : {}),
        ...(linkable ? { staff: null } : {}),
      },
      select: USER_SELECT,
      orderBy: { createdAt: 'desc' },
    });
    res.status(200).json({ success: true, count: users.length, data: users });
  } catch (error: unknown) {
    handleError(res, error, 'Failed to fetch users');
  }
};

// POST /api/users — invite: ADMIN creates an already ACTIVE user with an assigned role
export const inviteUser = async (req: Request, res: Response) => {
  try {
    const { email, password, name, role, department, shift } = req.body;

    const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existing) {
      return res.status(400).json({ success: false, message: 'User already exists with this email' });
    }

    const user = await prisma.user.create({
      data: {
        email,
        password: await bcrypt.hash(password, 12),
        name,
        role,
        department,
        shift,
        accountStatus: 'ACTIVE',
        // The admin vouches for the address of an invited user.
        emailVerifiedAt: new Date(),
        hospitalId: hospitalIdOf(req),
      },
      select: USER_SELECT,
    });
    await linkStaffToUserByEmail(user);
    res.status(201).json({ success: true, data: user });
  } catch (error: unknown) {
    handleError(res, error, 'Failed to create user');
  }
};

// PUT /api/users/:id/approve — PENDING -> ACTIVE with the role chosen by the admin
export const approveUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params as { id: string };
    const { role, department } = req.body;

    const target = await prisma.user.findFirst({
      where: { id, hospitalId: hospitalIdOf(req) },
      select: { id: true, accountStatus: true },
    });
    if (!target) return res.status(404).json({ success: false, code: 'USER_NOT_FOUND', message: 'User not found' });
    if (target.accountStatus !== 'PENDING') {
      return res.status(409).json({ success: false, message: 'User is not pending approval' });
    }

    const user = await prisma.user.update({
      where: { id },
      data: { accountStatus: 'ACTIVE', role, ...(department ? { department } : {}) },
      select: USER_SELECT,
    });
    await linkStaffToUserByEmail(user);
    res.status(200).json({ success: true, data: user });
  } catch (error: unknown) {
    handleError(res, error, 'Failed to approve user');
  }
};

// PUT /api/users/:id/reject — PENDING -> DISABLED
export const rejectUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params as { id: string };

    const target = await prisma.user.findFirst({
      where: { id, hospitalId: hospitalIdOf(req) },
      select: { id: true, accountStatus: true },
    });
    if (!target) return res.status(404).json({ success: false, code: 'USER_NOT_FOUND', message: 'User not found' });
    if (target.accountStatus !== 'PENDING') {
      return res.status(409).json({ success: false, message: 'User is not pending approval' });
    }

    const user = await prisma.user.update({
      where: { id },
      data: { accountStatus: 'DISABLED' },
      select: USER_SELECT,
    });
    res.status(200).json({ success: true, data: user });
  } catch (error: unknown) {
    handleError(res, error, 'Failed to reject user');
  }
};

// PUT /api/users/:id/deactivate — ACTIVE -> DISABLED (an admin cannot lock themselves out)
export const deactivateUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params as { id: string };
    if (id === req.user?.id) {
      return res.status(400).json({ success: false, message: 'You cannot deactivate your own account' });
    }

    const target = await prisma.user.findFirst({
      where: { id, hospitalId: hospitalIdOf(req) },
      select: { id: true },
    });
    if (!target) return res.status(404).json({ success: false, code: 'USER_NOT_FOUND', message: 'User not found' });

    const user = await prisma.user.update({
      where: { id },
      data: { accountStatus: 'DISABLED' },
      select: USER_SELECT,
    });
    res.status(200).json({ success: true, data: user });
  } catch (error: unknown) {
    handleError(res, error, 'Failed to deactivate user');
  }
};

// PUT /api/users/:id/role — change the role of an existing (non-pending) user of the admin's hospital.
// Own role is off limits (an admin cannot demote themselves), and the hospital always keeps an ACTIVE ADMIN: the
// check runs inside a serializable transaction so two admins demoting each other at once cannot both succeed.
// The user's sessions are revoked because their sockets/rooms were joined with the old role.
export const changeUserRole = async (req: Request, res: Response) => {
  try {
    const { id } = req.params as { id: string };
    const { role } = req.body as { role: Role };
    const hospitalId = hospitalIdOf(req);
    if (id === req.user?.id) {
      return res.status(400).json({ success: false, message: 'You cannot change your own role' });
    }

    const target = await prisma.user.findFirst({ where: { id, hospitalId }, select: { id: true, email: true, role: true, accountStatus: true } });
    if (!target) return res.status(404).json({ success: false, code: 'USER_NOT_FOUND', message: 'User not found' });
    if (target.accountStatus === 'PENDING') {
      return res.status(409).json({ success: false, message: 'Approve the user to give them a role' });
    }
    if (target.role === role) return res.status(200).json({ success: true, data: target });

    const user = await prisma.$transaction(
      async (tx) => {
        const updated = await tx.user.update({ where: { id }, data: { role, passwordChangedAt: new Date() }, select: USER_SELECT });
        const admins = await tx.user.count({ where: { hospitalId, role: 'ADMIN', accountStatus: 'ACTIVE' } });
        if (admins === 0) throw new LastAdminError();
        return updated;
      },
      { isolationLevel: 'Serializable' },
    );

    sendSecurityNotice(
      target.email,
      'Your HospiLink role was changed',
      `An administrator changed your role from ${target.role} to ${role} and signed you out everywhere. Sign in again to continue.`,
    );
    res.status(200).json({ success: true, data: user });
  } catch (error: unknown) {
    if (error instanceof LastAdminError) {
      return res.status(409).json({ success: false, code: 'LAST_ADMIN', message: 'The hospital must keep at least one active admin' });
    }
    // A concurrent serializable transaction won (40001 / P2034); the admin can simply retry.
    if (isSerializationFailure(error)) {
      return res.status(409).json({ success: false, code: 'CONFLICT', message: 'Concurrent change, please retry' });
    }
    handleError(res, error, 'Failed to change user role');
  }
};

// PUT /api/users/:id/activate — DISABLED -> ACTIVE with an explicit role (counterpart of deactivate/reject)
export const activateUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params as { id: string };
    const { role } = req.body as { role: Role };

    const target = await prisma.user.findFirst({
      where: { id, hospitalId: hospitalIdOf(req) },
      select: { id: true, email: true, accountStatus: true },
    });
    if (!target) return res.status(404).json({ success: false, code: 'USER_NOT_FOUND', message: 'User not found' });
    if (target.accountStatus !== 'DISABLED') {
      return res.status(409).json({ success: false, message: 'Only a deactivated user can be activated' });
    }

    const user = await prisma.user.update({
      where: { id },
      data: { accountStatus: 'ACTIVE', role },
      select: USER_SELECT,
    });
    await linkStaffToUserByEmail(user);
    sendSecurityNotice(target.email, 'Your HospiLink account was reactivated', `An administrator reactivated your account with the role ${role}.`);
    res.status(200).json({ success: true, data: user });
  } catch (error: unknown) {
    handleError(res, error, 'Failed to activate user');
  }
};

// POST /api/users/:id/2fa/reset — lost authenticator and recovery codes: an ADMIN of the same hospital clears the
// user's 2FA (they can enrol again after signing in) and revokes their sessions. Own account: use the settings page.
export const resetUserTwoFactor = async (req: Request, res: Response) => {
  try {
    const { id } = req.params as { id: string };
    if (id === req.user?.id) {
      return res.status(400).json({ success: false, message: 'Manage your own two-factor authentication from your settings' });
    }

    const target = await prisma.user.findFirst({
      where: { id, hospitalId: hospitalIdOf(req) },
      select: { id: true, email: true, twoFactorEnabledAt: true },
    });
    if (!target) return res.status(404).json({ success: false, code: 'USER_NOT_FOUND', message: 'User not found' });
    if (!target.twoFactorEnabledAt) {
      return res.status(409).json({ success: false, message: 'Two-factor authentication is not enabled for this user' });
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id },
        data: {
          twoFactorSecretEnc: null,
          twoFactorEnabledAt: null,
          twoFactorLastStep: null,
          twoFactorFailures: 0,
          twoFactorLockedUntil: null,
          passwordChangedAt: new Date(), // revokes the sessions that exist now
        },
      }),
      prisma.twoFactorRecoveryCode.deleteMany({ where: { userId: id } }),
    ]);

    sendSecurityNotice(
      target.email,
      'Two-factor authentication was reset',
      'An administrator reset two-factor authentication on your HospiLink account and signed you out everywhere. Sign in again and set it up again.',
    );

    res.status(200).json({ success: true, message: 'Two-factor authentication reset' });
  } catch (error: unknown) {
    handleError(res, error, 'Failed to reset two-factor authentication');
  }
};
