// backend/src/routes/notifications.routes.ts
import { Router } from 'express';
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  broadcastNotification,
} from '../controllers/notifications.controller';
import { protect, authorize } from '../middlewares/auth.middleware';
import { logActivity } from '../middlewares/audit.middleware';
import { validate } from '../middlewares/validate.middleware';
import { idParams } from '../validators/common.validator';
import { notificationsQuerySchema, broadcastSchema } from '../validators/notification.validator';

const router = Router();

router.get('/', protect, validate({ query: notificationsQuerySchema }), getNotifications);
router.post(
  '/broadcast',
  protect,
  authorize('ADMIN'),
  validate({ body: broadcastSchema }),
  logActivity('BROADCAST_NOTIFICATION'),
  broadcastNotification,
);
router.put('/read-all', protect, markAllAsRead);
router.put('/:id/read', protect, validate({ params: idParams }), markAsRead);
router.delete('/:id', protect, validate({ params: idParams }), deleteNotification);

export default router;
