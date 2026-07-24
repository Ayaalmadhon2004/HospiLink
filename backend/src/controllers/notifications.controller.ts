// backend/src/controllers/notifications.controller.ts
import { Request, Response } from 'express';
import prisma from '../config/db';
import { io } from '../server';

const handleError = (res: Response, error: any, message: string) => {
  console.error(`[Notifications] ${message}:`, error);
  res.status(500).json({ success: false, message, error: error.message });
};

// GET /api/notifications
export const getNotifications = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: 'Not authenticated' });

    const { limit = '20', unreadOnly = 'false' } = req.query;
    const where: any = { userId };
    if (unreadOnly === 'true') where.read = false;

    const notifications = await prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Number(limit),
    });

    const unreadCount = await prisma.notification.count({
      where: { userId, read: false },
    });

    res.status(200).json({ success: true, data: notifications, unreadCount });
  } catch (error: any) {
    handleError(res, error, 'Failed to fetch notifications');
  }
};

// PUT /api/notifications/:id/read
export const markAsRead = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;
    if (!userId) return res.status(401).json({ success: false, message: 'Not authenticated' });

    const notification = await prisma.notification.updateMany({
      where: { id, userId },
      data: { read: true },
    });

    res.status(200).json({ success: true, data: notification });
  } catch (error: any) {
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
  } catch (error: any) {
    handleError(res, error, 'Failed to mark all as read');
  }
};

// DELETE /api/notifications/:id
export const deleteNotification = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;
    if (!userId) return res.status(401).json({ success: false, message: 'Not authenticated' });

    await prisma.notification.deleteMany({
      where: { id, userId },
    });

    res.status(200).json({ success: true, message: 'Notification deleted' });
  } catch (error: any) {
    handleError(res, error, 'Failed to delete notification');
  }
};

// Internal: create notification (called from other controllers)
export const createNotification = async (data: {
  userId: string;
  type: string;
  title: string;
  message: string;
  link?: string;
}) => {
  try {
    const notification = await prisma.notification.create({ data });
    io.to(`user-${data.userId}`).emit('new-notification', notification);
    return notification;
  } catch (error) {
    console.error('Failed to create notification:', error);
    return null;
  }
};