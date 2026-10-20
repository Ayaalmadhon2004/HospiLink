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
import { validate } from '../middlewares/validate.middleware';
import { updateProfileSchema, updateNotificationSettingsSchema, updateSecuritySettingsSchema, updateDisplaySettingsSchema } from '../validators/settings.validator';

const router = Router();

router.get('/', protect, getUserSettings);
router.put('/profile', protect, validate({ body: updateProfileSchema }), logActivity('UPDATE_PROFILE'), updateProfile);
router.put('/notifications', protect, validate({ body: updateNotificationSettingsSchema }), logActivity('UPDATE_NOTIFICATIONS'), updateNotifications);
router.put('/security', protect, validate({ body: updateSecuritySettingsSchema }), logActivity('UPDATE_SECURITY'), updateSecurity);
router.put('/display', protect, validate({ body: updateDisplaySettingsSchema }), logActivity('UPDATE_DISPLAY'), updateDisplay);

export default router;