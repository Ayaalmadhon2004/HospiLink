// backend/src/controllers/notifications.controller.ts
import { Request, Response } from 'express';
import prisma from '../config/db';
import logger from '../config/logger';
import type { Prisma } from '@prisma/client';
import { notify } from '../services/notification.service';
import { pageParams, pageInfo } from '../utils/pagination';

const handleError = (res: Response, error: unknown, message: string) => {
  logger.error({ err: error }, `[Notifications] ${message}:`);
  res.status(500).json({ success: false, message });
};

// GET /api/notifications
export const getNotifications = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: 'Not authenticated' });

    const page = pageParams(req.query, 20);
    const where: Prisma.NotificationWhereInput = { userId };
    if (req.query.unreadOnly === 'true') where.read = false;

    const [notifications, totalCount, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: page.skip,
        take: page.take,
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { userId, read: false } }),
    ]);

    res.status(200).json({ success: true, data: notifications, unreadCount, pagination: pageInfo(page, totalCount) });
  } catch (error: unknown) {
    handleError(res, error, 'Failed to fetch notifications');
  }
};

// PUT /api/notifications/:id/read
export const markAsRead = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const id = String(req.params.id); // FIX: cast to string
    if (!userId) return res.status(401).json({ success: false, message: 'Not authenticated' });

    const notification = await prisma.notification.updateMany({
      where: { id, userId },
      data: { read: true },
    });

    res.status(200).json({ success: true, data: notification });
  } catch (error: unknown) {
    handleError(res, error, 'Failed to mark as read');
  }
};

// PUT /api/notifications/read-all
export const markAllAsRead = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: 'Not authenticated' });

    await prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });

    res.status(200).json({ success: true, message: 'All notifications marked as read' });
  } catch (error: unknown) {
    handleError(res, error, 'Failed to mark all as read');
  }
};

// DELETE /api/notifications/:id
export const deleteNotification = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const id = String(req.params.id); // FIX: cast to string
    if (!userId) return res.status(401).json({ success: false, message: 'Not authenticated' });

    await prisma.notification.deleteMany({
      where: { id, userId },
    });

    res.status(200).json({ success: true, message: 'Notification deleted' });
  } catch (error: unknown) {
    handleError(res, error, 'Failed to delete notification');
  }
};

// Internal: kept for backwards compatibility; implemented in the notification service.
export { createNotification } from '../services/notification.service';

// POST /api/notifications/broadcast (ADMIN) - SYSTEM message to the whole hospital or to one role
export const broadcastNotification = async (req: Request, res: Response) => {
  try {
    const { title, message, role, link } = req.body as {
      title: string;
      message: string;
      role?: 'ADMIN' | 'DOCTOR' | 'NURSE' | 'DISPATCHER' | 'PHARMACIST' | 'BILLING';
      link?: string;
    };
    const adminId = req.user?.id;
    if (!adminId) return res.status(401).json({ success: false, message: 'Not authenticated' });

    const admin = await prisma.user.findUnique({ where: { id: adminId }, select: { hospitalId: true } });
    if (!admin) return res.status(401).json({ success: false, message: 'Not authenticated' });

    const created = await notify({
      type: 'SYSTEM',
      title,
      message,
      link,
      recipients: {
        hospitalId: admin.hospitalId,
        roles: role ? [role] : ['ADMIN', 'DOCTOR', 'NURSE', 'DISPATCHER', 'PHARMACIST', 'BILLING'],
      },
    });

    res.status(201).json({ success: true, message: 'Broadcast sent', data: { recipients: created.length } });
  } catch (error: unknown) {
    handleError(res, error, 'Failed to send broadcast');
  }
};
