import { Router } from 'express';
import { admitPatient, uploadReport } from '../controllers/patient.controller';
import { protect, authorize } from '../middlewares/auth.middleware';
import { logActivity } from '../middlewares/audit.middleware';
import { upload } from '../middlewares/upload.middleware';

const router = Router();

router.post(
  '/admit', 
  protect, 
  authorize('DOCTOR', 'NURSE'), 
  logActivity('ADMIT_PATIENT'), 
  admitPatient
);
router.post(
  '/upload-report', 
  protect, 
  upload.single('reportFile'), // 'reportFile' هو اسم الحقل في الـ Form
  uploadReport
);

export default router;