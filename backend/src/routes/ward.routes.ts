// src/routes/ward.routes.ts
import { Router } from 'express';
import { getAllWards } from '../controllers/ward.controller';
import { protect } from '../middlewares/auth.middleware';

const router = Router();

// ✅ Restored protect
router.get('/', protect, getAllWards);

export default router;