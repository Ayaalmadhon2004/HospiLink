// backend/src/routes/pharmacyBilling.routes.ts
//
// Pharmacy: stock + dispensing (ADMIN, PHARMACIST; DOCTOR/NURSE may read stock and dispense from the patient page).
// Billing: invoices + payments (ADMIN, BILLING).
import { Router } from 'express';
import { protect, authorize } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { logActivity } from '../middlewares/audit.middleware';
import { idParams } from '../validators/common.validator';
import * as p from '../validators/pharmacy.validator';
import * as b from '../validators/billing.validator';
import { listStock, receiveStock, adjustStock, dispense, listDispensations, listMovements, dispenseQueue } from '../controllers/pharmacy.controller';
import { searchBillablePatients } from '../controllers/billingPatients.controller';
import { listInvoices, getInvoice, createInvoice, addLine, removeLine, setDiscount, issueInvoice, addPayment, voidInvoice } from '../controllers/billing.controller';

export const pharmacyRouter = Router();
pharmacyRouter.use(protect);
const PHARMACY_STAFF = ['ADMIN', 'PHARMACIST'] as const;
pharmacyRouter.get('/stock', authorize(...PHARMACY_STAFF, 'DOCTOR', 'NURSE'), validate({ query: p.stockQuery }), listStock);
// Worklist: ACTIVE prescriptions waiting to be dispensed, with the patient's name/code only (no clinical notes).
pharmacyRouter.get('/queue', authorize(...PHARMACY_STAFF, 'DOCTOR', 'NURSE'), validate({ query: p.queueQuery }), dispenseQueue);
pharmacyRouter.get('/dispensations', authorize(...PHARMACY_STAFF, 'DOCTOR', 'NURSE'), validate({ query: p.dispensationsQuery }), listDispensations);
pharmacyRouter.post('/dispense', authorize(...PHARMACY_STAFF, 'DOCTOR', 'NURSE'), validate({ body: p.dispenseSchema }), logActivity('DISPENSE_MEDICATION'), dispense);
pharmacyRouter.get('/movements', authorize(...PHARMACY_STAFF), validate({ query: p.movementsQuery }), listMovements);
pharmacyRouter.post('/receive', authorize(...PHARMACY_STAFF), validate({ body: p.receiveSchema }), logActivity('RECEIVE_STOCK'), receiveStock);
pharmacyRouter.post('/adjust', authorize(...PHARMACY_STAFF), validate({ body: p.adjustSchema }), logActivity('ADJUST_STOCK'), adjustStock);

export const billingRouter = Router();
billingRouter.use(protect, authorize('ADMIN', 'BILLING'));
// Minimal patient picker (id, name, code): billing staff have no access to clinical patient data.
billingRouter.get('/patients', validate({ query: b.patientLookupQuery }), searchBillablePatients);
billingRouter.get('/invoices', validate({ query: b.invoiceListQuery }), listInvoices);
billingRouter.get('/invoices/:id', validate({ params: idParams }), getInvoice);
billingRouter.post('/invoices', validate({ body: b.createInvoiceSchema }), logActivity('CREATE_INVOICE'), createInvoice);
billingRouter.post('/invoices/:id/lines', validate({ params: idParams, body: b.addLineSchema }), logActivity('ADD_INVOICE_LINE'), addLine);
billingRouter.delete('/invoices/:id/lines/:lineId', validate({ params: b.lineParams }), logActivity('REMOVE_INVOICE_LINE'), removeLine);
billingRouter.put('/invoices/:id/discount', validate({ params: idParams, body: b.discountSchema }), logActivity('SET_INVOICE_DISCOUNT'), setDiscount);
billingRouter.post('/invoices/:id/issue', validate({ params: idParams }), logActivity('ISSUE_INVOICE'), issueInvoice);
billingRouter.post('/invoices/:id/payments', validate({ params: idParams, body: b.paymentSchema }), logActivity('RECORD_PAYMENT'), addPayment);
billingRouter.post('/invoices/:id/void', validate({ params: idParams }), logActivity('VOID_INVOICE'), voidInvoice);
