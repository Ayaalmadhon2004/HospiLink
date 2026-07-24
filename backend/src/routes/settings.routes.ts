// src/routes/settings.routes.ts
import { Router } from 'express';
import {
  getUserSettings,
  updateProfile,
  updateNotifications,
  updateSecurity,
  updateDisplay,
} from '../controllers/settings.controller';
import { protect } from '../middlewares/auth.middleware';
import { logActivity } from '../middlewares/audit.middleware';

const router = Router();

router.get('/', protect, getUserSettings);
router.put('/profile', protect, logActivity('UPDATE_PROFILE'), updateProfile);
router.put('/notifications', protect, logActivity('UPDATE_NOTIFICATIONS'), updateNotifications);
router.put('/security', protect, logActivity('UPDATE_SECURITY'), updateSecurity);
router.put('/display', protect, logActivity('UPDATE_DISPLAY'), updateDisplay);

export default router;