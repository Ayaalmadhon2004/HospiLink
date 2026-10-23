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

// ✅ NEW: PUT /api/auth/password — update password (protected)
router.put('/password', protect, updatePassword);

export default router;