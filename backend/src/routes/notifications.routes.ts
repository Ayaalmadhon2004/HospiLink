// backend/src/routes/notifications.routes.ts
import { Router } from 'express';
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
} from '../controllers/notifications.controller';
import { protect } from '../middlewares/auth.middleware';

const router = Router();

router.get('/', protect, getNotifications);
router.put('/read-all', protect, markAllAsRead);
router.put('/:id/read', protect, markAsRead);
router.delete('/:id', protect, deleteNotification);

export default router;