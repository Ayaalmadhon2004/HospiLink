import { Router } from 'express';
import { admitPatient } from '../controllers/patient.controller';
import { protect, authorize } from '../middlewares/auth.middleware';

const router = Router();

// المسار محمي بـ protect (للمسجلين فقط) و authorize (للطاقم الطبي فقط)
router.post('/admit', protect, authorize('DOCTOR', 'NURSE'), admitPatient);

export default router;