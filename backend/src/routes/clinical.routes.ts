// backend/src/routes/clinical.routes.ts
//
// Clinical records. Read: DOCTOR, NURSE, ADMIN. Write: see each line. DISPATCHER, PHARMACIST and BILLING have no access except the medication catalogue (PHARMACIST).
import { Router } from 'express';
import { protect, authorize } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { logActivity } from '../middlewares/audit.middleware';
import { idParams } from '../validators/common.validator';
import * as v from '../validators/clinical.validator';
import { listNotes, noteHistory, createNote, amendNote } from '../controllers/clinicalNotes.controller';
import { listMedications, createMedication, updateMedication } from '../controllers/medications.controller';
import { listPrescriptions, createPrescription, closePrescription } from '../controllers/prescriptions.controller';
import { listLabOrders, createLabOrder, submitResults, cancelLabOrder } from '../controllers/labOrders.controller';

const READ = ['ADMIN', 'DOCTOR', 'NURSE'] as const;

export const notesRouter = Router();
notesRouter.use(protect);
notesRouter.get('/', authorize(...READ), validate({ query: v.noteListQuery }), listNotes);
notesRouter.get('/:id/history', authorize(...READ), validate({ params: idParams }), noteHistory);
// The role/type rule (nurses: NURSING only) lives in the controller, which knows the note type.
notesRouter.post('/', authorize('DOCTOR', 'NURSE'), validate({ body: v.createNoteSchema }), logActivity('CREATE_CLINICAL_NOTE'), createNote);
notesRouter.post('/:id/amend', authorize('DOCTOR', 'NURSE'), validate({ params: idParams, body: v.amendNoteSchema }), logActivity('AMEND_CLINICAL_NOTE'), amendNote);

export const medicationsRouter = Router();
medicationsRouter.use(protect);
medicationsRouter.get('/', authorize(...READ, 'PHARMACIST'), validate({ query: v.medicationListQuery }), listMedications);
medicationsRouter.post('/', authorize('ADMIN', 'DOCTOR', 'PHARMACIST'), validate({ body: v.createMedicationSchema }), logActivity('CREATE_MEDICATION'), createMedication);
medicationsRouter.put('/:id', authorize('ADMIN', 'DOCTOR', 'PHARMACIST'), validate({ params: idParams, body: v.updateMedicationSchema }), logActivity('UPDATE_MEDICATION'), updateMedication);

export const prescriptionsRouter = Router();
prescriptionsRouter.use(protect);
prescriptionsRouter.get('/', authorize(...READ), validate({ query: v.prescriptionListQuery }), listPrescriptions);
prescriptionsRouter.post('/', authorize('DOCTOR'), validate({ body: v.createPrescriptionSchema }), logActivity('CREATE_PRESCRIPTION'), createPrescription);
prescriptionsRouter.put('/:id/status', authorize('DOCTOR'), validate({ params: idParams, body: v.closePrescriptionSchema }), logActivity('CLOSE_PRESCRIPTION'), closePrescription);

export const labOrdersRouter = Router();
labOrdersRouter.use(protect);
labOrdersRouter.get('/', authorize(...READ), validate({ query: v.labListQuery }), listLabOrders);
labOrdersRouter.post('/', authorize('DOCTOR'), validate({ body: v.createLabOrderSchema }), logActivity('CREATE_LAB_ORDER'), createLabOrder);
labOrdersRouter.post('/:id/results', authorize('DOCTOR', 'NURSE'), validate({ params: idParams, body: v.submitResultsSchema }), logActivity('SUBMIT_LAB_RESULTS'), submitResults);
labOrdersRouter.put('/:id/cancel', authorize('DOCTOR'), validate({ params: idParams }), logActivity('CANCEL_LAB_ORDER'), cancelLabOrder);
