// src/routes/auth.ts
import { Router } from 'express';
import {
  register,
  login,
  logout,
  getMe,
  updatePassword,
} from '../controllers/auth.controller';
import { protect } from '../middlewares/auth.middleware';

const router = Router();

// GET /api/auth/me
router.get('/me', protect, getMe);

// POST /api/auth/signup
router.post('/signup', register);

// POST /api/auth/login
router.post('/login', login);

// POST /api/auth/logout
router.post('/logout', logout);

// ✅ NEW: PUT /api/auth/password — update password (protected)
router.put('/password', protect, updatePassword);

export default router;