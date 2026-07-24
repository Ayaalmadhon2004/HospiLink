// src/controllers/settings.controller.ts
import { Request, Response } from 'express';
import prisma from '../config/db';

const handleError = (res: Response, error: any, message: string, statusCode: number = 500) => {
  console.error(`[Settings Error] ${message}:`, error);
  res.status(statusCode).json({
    success: false,
    message,
    error: error?.message || 'Unknown error'
  });
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
      select: { id: true, name: true, email: true, role: true, department: true, shift: true, status: true }
    });

    res.status(200).json({
      success: true,
      data: {
        profile: user,
        notifications: {
          criticalVitalsAlerts: settings.criticalVitalsAlerts,
          incidentEscalations: settings.incidentEscalations,
          shiftReminders: settings.shiftReminders,
          dispatchAlerts: settings.dispatchAlerts,
          appointmentReminders: settings.appointmentReminders,
        },
        security: {
          twoFactorAuth: settings.twoFactorAuth,
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
  } catch (error: any) {
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

    const { name, department, shift } = req.body;

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        name: name || undefined,
        department: department || undefined,
        shift: shift || undefined,
      },
      select: { id: true, name: true, email: true, role: true, department: true, shift: true, status: true }
    });

    res.status(200).json({ success: true, data: updatedUser });
  } catch (error: any) {
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
  } catch (error: any) {
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

    const { twoFactorAuth, autoLockIdleSessions, compactDensity } = req.body;

    const settings = await prisma.userSettings.upsert({
      where: { userId },
      update: {
        twoFactorAuth,
        autoLockIdleSessions,
        compactDensity,
      },
      create: {
        userId,
        twoFactorAuth,
        autoLockIdleSessions,
        compactDensity,
      }
    });

    res.status(200).json({ success: true, data: settings });
  } catch (error: any) {
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
  } catch (error: any) {
    handleError(res, error, 'Failed to update display settings');
  }
};