// src/routes/settings.routes.ts
import { Router } from 'express';
import {
  getUserSettings,
  updateNotifications,
  updateSecurity,
  updateDisplay,
} from '../controllers/settings.controller';
import { protect } from '../middlewares/auth.middleware';

const router = Router();

// كل الـ routes محمية
router.get('/', protect, getUserSettings);
router.put('/notifications', protect, updateNotifications);
router.put('/security', protect, updateSecurity);
router.put('/display', protect, updateDisplay);

export default router;