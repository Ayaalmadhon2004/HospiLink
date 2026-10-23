// src/routes/auth.ts
import { Router } from 'express';
import {
  register,
  login,
  logout,
  getMe,
  updatePassword,
  forgotPassword,
  resetPassword,
  verifyEmail,
  resendVerification,
} from '../controllers/auth.controller';
import rateLimit from 'express-rate-limit';
import { protect } from '../middlewares/auth.middleware';
import { logActivity } from '../middlewares/audit.middleware';
import {
  twoFactorLogin,
  twoFactorSetup,
  twoFactorEnable,
  twoFactorDisable,
} from '../controllers/twoFactor.controller';

// Per-IP cap on second-step attempts (on top of the per-account lockout in services/twoFactor.ts).
const twoFactorLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Too many attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Mail-sending endpoints: stops the API being used to mail-bomb a victim.
const mailLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { success: false, message: 'Too many requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const router = Router();

// GET /api/auth/me
router.get('/me', protect, getMe);

// POST /api/auth/signup
router.post('/signup', register);

// POST /api/auth/login
router.post('/login', login);

// POST /api/auth/logout
router.post('/logout', logout);

// POST /api/auth/forgot-password — always answers 200 (no user enumeration)
router.post('/forgot-password', mailLimiter, forgotPassword);

// POST /api/auth/reset-password — { token, password }
router.post('/reset-password', resetPassword);

// POST /api/auth/verify-email — { token }
router.post('/verify-email', verifyEmail);

// POST /api/auth/resend-verification — { email }
router.post('/resend-verification', mailLimiter, resendVerification);

// POST /api/auth/2fa/login — { challengeToken, code | recoveryCode }
router.post('/2fa/login', twoFactorLoginLimiter, twoFactorLogin);

// 2FA management (signed-in user)
router.post('/2fa/setup', protect, logActivity('2FA_SETUP'), twoFactorSetup);
router.post('/2fa/enable', protect, logActivity('2FA_ENABLE'), twoFactorEnable);
router.post('/2fa/disable', protect, logActivity('2FA_DISABLE'), twoFactorDisable);

// ✅ NEW: PUT /api/auth/password — update password (protected)
router.put('/password', protect, updatePassword);

export default router;