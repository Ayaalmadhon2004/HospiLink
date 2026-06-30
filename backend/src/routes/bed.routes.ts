// backend/src/routes/bed.routes.ts
import { Router } from 'express';
import { getAvailableBeds } from '../controllers/bed.controller';
import { protect } from '../middlewares/auth.middleware';

const router = Router();

router.get('/available', protect, getAvailableBeds);

export default router;