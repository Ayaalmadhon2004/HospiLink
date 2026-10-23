// backend/src/controllers/users.controller.ts
//
// Account administration (ADMIN only, enforced in users.routes.ts). Everything is scoped to the
// admin's own hospital: an admin can neither see nor activate users of another hospital.
import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../config/db';
import logger from '../config/logger';
import { hospitalIdOf } from '../utils/tenant';
import type { Prisma } from '@prisma/client';

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

const handleError = (res: Response, error: unknown, message: string) => {
  logger.error({ err: error }, `[Users] ${message}:`);
  res.status(500).json({ success: false, message });
};

// GET /api/users?accountStatus=PENDING
export const listUsers = async (req: Request, res: Response) => {
  try {
    const { accountStatus } = req.query as { accountStatus?: 'PENDING' | 'ACTIVE' | 'DISABLED' };
    const users = await prisma.user.findMany({
      where: { hospitalId: hospitalIdOf(req), ...(accountStatus ? { accountStatus } : {}) },
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
        hospitalId: hospitalIdOf(req),
      },
      select: USER_SELECT,
    });
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
    if (!target) return res.status(404).json({ success: false, message: 'User not found' });
    if (target.accountStatus !== 'PENDING') {
      return res.status(409).json({ success: false, message: 'User is not pending approval' });
    }

    const user = await prisma.user.update({
      where: { id },
      data: { accountStatus: 'ACTIVE', role, ...(department ? { department } : {}) },
      select: USER_SELECT,
    });
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
    if (!target) return res.status(404).json({ success: false, message: 'User not found' });
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
    if (!target) return res.status(404).json({ success: false, message: 'User not found' });

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
