// src/controllers/settings.controller.ts
import { Request, Response } from 'express';
import prisma from '../config/db';
import logger from '../config/logger';
import { hospitalIdOf } from '../utils/tenant';

const handleError = (res: Response, error: unknown, message: string, statusCode: number = 500) => {
  logger.error({ err: error }, `[Settings Error] ${message}:`);
  res.status(statusCode).json({
    success: false,
    message,
  });
};

const withoutTwoFactorTimestamp = <T extends { twoFactorEnabledAt?: Date | null }>(user: T) => {
  const { twoFactorEnabledAt: _enabledAt, ...rest } = user;
  return rest;
};

// GET /api/settings
export const getUserSettings = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'User not authenticated' });
    }

    let settings = await prisma.userSettings.findUnique({
      where: { userId }
    });

    if (!settings) {
      settings = await prisma.userSettings.create({
        data: { userId }
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, role: true, department: true, shift: true, status: true, twoFactorEnabledAt: true }
    });

    // The signup code is only shown to admins, who share it with staff joining their hospital.
    const hospital = req.user?.hospitalId
      ? await prisma.hospital.findUnique({
          where: { id: req.user.hospitalId },
          select: { name: true, timezone: true, code: req.user.role === 'ADMIN' },
        })
      : null;

    res.status(200).json({
      success: true,
      data: {
        profile: user ? withoutTwoFactorTimestamp(user) : user,
        hospital,
        notifications: {
          criticalVitalsAlerts: settings.criticalVitalsAlerts,
          incidentEscalations: settings.incidentEscalations,
          shiftReminders: settings.shiftReminders,
          dispatchAlerts: settings.dispatchAlerts,
          appointmentReminders: settings.appointmentReminders,
        },
        security: {
          // users.twoFactorEnabledAt is the source of truth (UserSettings.twoFactorAuth is no longer read).
          twoFactorAuth: Boolean(user?.twoFactorEnabledAt),
          autoLockIdleSessions: settings.autoLockIdleSessions,
          compactDensity: settings.compactDensity,
        },
        display: {
          theme: settings.theme,
          language: settings.language,
          timezone: settings.timezone,
        }
      }
    });
  } catch (error: unknown) {
    handleError(res, error, 'Failed to fetch settings');
  }
};

// PUT /api/settings/profile
export const updateProfile = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'User not authenticated' });
    }

    // Body is validated (zod): provided fields are non-empty, omitted ones stay unchanged.
    const { name, department, shift } = req.body as { name?: string; department?: string; shift?: string };

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        name,
        department,
        shift,
      },
      select: { id: true, name: true, email: true, role: true, department: true, shift: true, status: true }
    });

    res.status(200).json({ success: true, data: updatedUser });
  } catch (error: unknown) {
    handleError(res, error, 'Failed to update profile');
  }
};

// PUT /api/settings/notifications
export const updateNotifications = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'User not authenticated' });
    }

    const {
      criticalVitalsAlerts,
      incidentEscalations,
      shiftReminders,
      dispatchAlerts,
      appointmentReminders
    } = req.body;

    const settings = await prisma.userSettings.upsert({
      where: { userId },
      update: {
        criticalVitalsAlerts,
        incidentEscalations,
        shiftReminders,
        dispatchAlerts,
        appointmentReminders,
      },
      create: {
        userId,
        criticalVitalsAlerts,
        incidentEscalations,
        shiftReminders,
        dispatchAlerts,
        appointmentReminders,
      }
    });

    res.status(200).json({ success: true, data: settings });
  } catch (error: unknown) {
    handleError(res, error, 'Failed to update notifications');
  }
};

// PUT /api/settings/security
export const updateSecurity = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'User not authenticated' });
    }

    // twoFactorAuth is intentionally not persisted here: it is managed by /api/auth/2fa/* (the validator rejects it).
    const { autoLockIdleSessions, compactDensity } = req.body as {
      autoLockIdleSessions?: boolean;
      compactDensity?: boolean;
    };

    const settings = await prisma.userSettings.upsert({
      where: { userId },
      update: {
        autoLockIdleSessions,
        compactDensity,
      },
      create: {
        userId,
        autoLockIdleSessions,
        compactDensity,
      }
    });

    res.status(200).json({ success: true, data: { ...settings, twoFactorAuth: undefined } });
  } catch (error: unknown) {
    handleError(res, error, 'Failed to update security settings');
  }
};

// PUT /api/settings/display
export const updateDisplay = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'User not authenticated' });
    }

    const { theme, language, timezone } = req.body;

    const settings = await prisma.userSettings.upsert({
      where: { userId },
      update: { theme, language, timezone },
      create: {
        userId,
        theme,
        language,
        timezone,
      }
    });

    res.status(200).json({ success: true, data: settings });
  } catch (error: unknown) {
    handleError(res, error, 'Failed to update display settings');
  }
};

// PUT /api/settings/hospital (ADMIN) - hospital time zone
export const updateHospital = async (req: Request, res: Response) => {
  try {
    const hospitalId = hospitalIdOf(req);
    const hospital = await prisma.hospital.update({
      where: { id: hospitalId },
      data: { timezone: req.body.timezone },
      select: { name: true, timezone: true },
    });
    res.status(200).json({ success: true, data: hospital });
  } catch (error: unknown) {
    handleError(res, error, 'Failed to update hospital settings');
  }
};
