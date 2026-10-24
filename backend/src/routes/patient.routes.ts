import { Router } from 'express';
import { 
  admitPatient, 
  uploadReport, 
  getRecentPatients,
  getCriticalPatientCount,
  getPatientFlow,
  getPatients,       
  getPatientById,     
  updatePatient,      
  dischargePatient,
  deletePatient,
  getPatientReports,
  getAvailableBeds,
  getReportFile
} from '../controllers/patient.controller';
import { protect, authorize } from '../middlewares/auth.middleware';
import { logActivity } from '../middlewares/audit.middleware';
import { upload } from '../middlewares/upload.middleware';
import { validate } from '../middlewares/validate.middleware';
import { idParams, reportIdParams } from '../validators/common.validator';
import {
  admitPatientSchema,
  updatePatientSchema,
  listPatientsQuerySchema,
  availableBedsQuerySchema,
  patientFlowQuerySchema,
} from '../validators/patient.validator';

const router = Router();

// ============================================
// POST /api/patients/admit
// إدخال مريض جديد - بس DOCTOR أو NURSE
// ============================================
router.post(
  '/admit', 
  protect, 
  authorize('DOCTOR', 'NURSE','ADMIN'), 
  validate({ body: admitPatientSchema }),
  logActivity('ADMIT_PATIENT'),
  admitPatient
);

// ============================================
// POST /api/patients/upload-report
// رفع تقرير - أي مسجل دخول
// ============================================
router.post(
  '/:id/reports', 
  protect,
  validate({ params: idParams }), // params only: body is multipart
  upload.single('reportFile'), 
  logActivity('UPLOAD_REPORT'),
  uploadReport
);

// ============================================
// GET /api/patients/recent
// آخر 5 مرضى - DOCTOR, NURSE, ADMIN
// ============================================
router.get(
  '/recent', 
  protect, 
  authorize('DOCTOR', 'NURSE', 'ADMIN'), 
  getRecentPatients
);

// ============================================
// GET /api/patients/critical-count
// عدد المرضى الحرجين - DOCTOR, NURSE, ADMIN (no input, so no validator)
// ⚠️ MUST be BEFORE /:id route!
// ============================================
router.get(
  '/critical-count',
  protect,
  authorize('DOCTOR', 'NURSE', 'ADMIN'),
  getCriticalPatientCount
);

// ============================================
// GET /api/patients/flow
// Daily admissions/discharges - DOCTOR, NURSE, ADMIN
// ⚠️ MUST be BEFORE /:id route!
// ============================================
router.get(
  '/flow',
  protect,
  authorize('DOCTOR', 'NURSE', 'ADMIN'),
  validate({ query: patientFlowQuerySchema }),
  getPatientFlow
);

// ============================================
// ⚠️ MUST be BEFORE /:id route!
// GET /api/patients/beds/available
// الأسرة المتاحة للحجز
// ============================================
router.get(
  '/beds/available',
  protect,
  authorize('DOCTOR', 'NURSE', 'ADMIN'),
  validate({ query: availableBedsQuerySchema }),
  getAvailableBeds
);

// ============================================
// GET /api/patients/reports/:reportId/file
// ملف التقرير المخزّن بالداتابيز
// ============================================
router.get(
  '/reports/:reportId/file',
  protect,
  authorize('DOCTOR', 'NURSE', 'ADMIN'),
  validate({ params: reportIdParams }),
  logActivity('VIEW_REPORT_FILE'),
  getReportFile
);

// ============================================
// GET /api/patients
// كل المرضى مع فلاتر + Pagination
// ============================================
router.get(
  '/',
  protect,
  authorize('DOCTOR', 'NURSE', 'ADMIN', 'DISPATCHER'),
  validate({ query: listPatientsQuerySchema }),
  logActivity('LIST_PATIENTS'),
  getPatients
);

// ============================================
// GET /api/patients/:id
// تفاصيل مريض واحد
// ⚠️ This matches ANY string after / including "beds"!
// So /beds/available MUST be defined above this!
// ============================================
router.get(
  '/:id',
  protect,
  authorize('DOCTOR', 'NURSE', 'ADMIN'),
  validate({ params: idParams }),
  logActivity('VIEW_PATIENT'),
  getPatientById
);

router.get(
  '/:id/reports',
  protect,
  authorize('DOCTOR', 'NURSE', 'ADMIN'),
  validate({ params: idParams }),
  logActivity('VIEW_PATIENT_REPORTS'),
  getPatientReports
);


// ============================================
// PUT /api/patients/:id
// تحديث بيانات مريض
// ============================================
router.put(
  '/:id',
  protect,
  authorize('DOCTOR', 'NURSE', 'ADMIN'),
  validate({ params: idParams, body: updatePatientSchema }),
  logActivity('UPDATE_PATIENT'),
  updatePatient
);

// ============================================
// PUT /api/patients/:id/discharge
// تسريح مريض
// ============================================
router.put(
  '/:id/discharge',
  protect,
  authorize('DOCTOR', 'ADMIN'),
  validate({ params: idParams }),
  logActivity('DISCHARGE_PATIENT'),
  dischargePatient
);

// ============================================
// DELETE /api/patients/:id
// Soft delete (sets deletedAt) - ADMIN only
// ============================================
router.delete(
  '/:id',
  protect,
  authorize('ADMIN'),
  validate({ params: idParams }),
  logActivity('DELETE_PATIENT'),
  deletePatient
);

export default router;