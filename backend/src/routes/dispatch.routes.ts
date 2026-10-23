// src/routes/dispatch.routes.ts
import { Router } from 'express';
import {
  getAllUnits,
  getActiveUnits,
  getCalls,
  updateUnitStatus,
  createCall,
  assignUnitToCall,
} from '../controllers/dispatch.controller';
import { protect, authorize } from '../middlewares/auth.middleware';
import { logActivity } from '../middlewares/audit.middleware';
import { validate } from '../middlewares/validate.middleware';
import { idParams } from '../validators/common.validator';
import { updateUnitStatusSchema, createCallSchema, assignUnitSchema, listCallsQuery } from '../validators/dispatch.validator';

const router = Router();

// كل المستخدمين المصادقين يقدروا يشوفوا
router.get('/units', protect, getAllUnits);
router.get('/units/active', protect, getActiveUnits);
router.get('/calls', protect, validate({ query: listCallsQuery }), getCalls);

// Dispatchers و Admins فقط يقدروا يعدلوا
router.put('/units/:id/status', protect, authorize('ADMIN', 'DISPATCHER'), validate({ params: idParams, body: updateUnitStatusSchema }), logActivity('UPDATE_UNIT_STATUS'), updateUnitStatus);
router.post('/calls', protect, authorize('ADMIN', 'DISPATCHER', 'DOCTOR'), validate({ body: createCallSchema }), logActivity('CREATE_CALL'), createCall);
router.post('/calls/:id/assign', protect, authorize('ADMIN', 'DISPATCHER'), validate({ params: idParams, body: assignUnitSchema }), logActivity('ASSIGN_CALL'), assignUnitToCall);

export default router;