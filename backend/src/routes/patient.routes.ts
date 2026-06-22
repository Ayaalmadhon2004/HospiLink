import { Router } from 'express';
import { admitPatient } from '../controllers/patient.controller';
import { protect, authorize } from '../middlewares/auth.middleware';
import { logActivity } from '../middlewares/audit.middleware';

const router = Router();

router.post(
  '/admit', 
  protect, 
  authorize('DOCTOR', 'NURSE'), 
  logActivity('ADMIT_PATIENT'), 
  admitPatient
);

export default router;