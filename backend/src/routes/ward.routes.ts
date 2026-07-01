import { Router } from 'express';
import { getAllWards } from '../controllers/ward.controller';

const router = Router();
router.get('/', getAllWards);  // ← شيل protect

export default router;