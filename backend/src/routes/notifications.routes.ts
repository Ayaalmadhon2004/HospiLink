// backend/src/routes/notifications.routes.ts
import { Router } from 'express';
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
} from '../controllers/notifications.controller';
import { protect } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { idParams } from '../validators/common.validator';
import { notificationsQuerySchema } from '../validators/notification.validator';

const router = Router();

router.get('/', protect, validate({ query: notificationsQuerySchema }), getNotifications);
router.put('/read-all', protect, markAllAsRead);
router.put('/:id/read', protect, validate({ params: idParams }), markAsRead);
router.delete('/:id', protect, validate({ params: idParams }), deleteNotification);

export default router;