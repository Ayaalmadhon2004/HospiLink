import { prismaMock } from '../mocks/prisma';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../../src/config/jwt';
import { pharmacyRouter, billingRouter } from '../../src/routes/pharmacyBilling.routes';
import exportsRoutes from '../../src/routes/exports.routes';
import { medicationsRouter, notesRouter, prescriptionsRouter, labOrdersRouter } from '../../src/routes/clinical.routes';

jest.mock('../../src/middlewares/audit.middleware', () => ({ logActivity: () => (_r: any, _s: any, n: any) => n() }));

const app = express();
app.use(express.json());
app.use('/pharmacy', pharmacyRouter);
app.use('/billing', billingRouter);
app.use('/medications', medicationsRouter);
app.use('/exports', exportsRoutes);
app.use('/clinical-notes', notesRouter);
app.use('/prescriptions', prescriptionsRouter);
app.use('/lab-orders', labOrdersRouter);

const ID = '3f2b8c1e-6f0a-4a57-9a39-1c1d8b3f7a10';
const as = (role: string) => {
  prismaMock.user.findUnique.mockResolvedValue({ id: 'u1', email: 'u@h.com', role, hospitalId: 'hosp-1', accountStatus: 'ACTIVE', name: 'N' } as any);
  return `Bearer ${jwt.sign({ userId: 'u1' }, JWT_SECRET)}`;
};
const call = (method: string, url: string, role: string, send: object = {}) => (request(app) as any)[method](url).set('Authorization', as(role)).send(send);

beforeEach(() => {
  prismaMock.medication.findMany.mockResolvedValue([] as any);
  prismaMock.medication.count.mockResolvedValue(0 as any);
  prismaMock.prescription.findMany.mockResolvedValue([] as any);
  prismaMock.prescription.count.mockResolvedValue(0 as any);
  prismaMock.stockMovement.findMany.mockResolvedValue([] as any);
  prismaMock.stockMovement.count.mockResolvedValue(0 as any);
  prismaMock.invoice.findMany.mockResolvedValue([] as any);
  prismaMock.invoice.count.mockResolvedValue(0 as any);
  prismaMock.patient.findMany.mockResolvedValue([] as any);
});

describe('PHARMACIST', () => {
  it('runs the pharmacy: stock, queue, movements, receive, adjust and the medication catalogue', async () => {
    for (const url of ['/pharmacy/stock', '/pharmacy/queue', '/pharmacy/movements', '/medications']) {
      expect((await call('get', url, 'PHARMACIST')).status).toBe(200);
    }
    // authorised: the body is validated next (400), not refused (403)
    expect((await call('post', '/pharmacy/receive', 'PHARMACIST', { medicationId: ID, quantity: 0 })).status).toBe(400);
    expect((await call('post', '/pharmacy/adjust', 'PHARMACIST', { medicationId: ID, delta: -1 })).status).toBe(400);
    expect((await call('post', '/medications', 'PHARMACIST', {})).status).toBe(400);
    prismaMock.prescriptionItem.findFirst.mockResolvedValue(null);
    expect((await call('post', '/pharmacy/dispense', 'PHARMACIST', { prescriptionItemId: ID, quantity: 1 })).status).toBe(404);
  });

  it('the queue is hospital-scoped, ACTIVE only, and exposes only name + code of the patient', async () => {
    await call('get', '/pharmacy/queue?q=ali', 'PHARMACIST');
    const arg = prismaMock.prescription.findMany.mock.calls[0][0] as any;
    expect(arg.where.hospitalId).toBe('hosp-1');
    expect(arg.where.status).toBe('ACTIVE');
    expect(arg.where.patient.deletedAt).toBeNull();
    expect(arg.select.patient.select).toEqual({ id: true, name: true, patientCode: true });
  });

  it('has no access to clinical records, billing, or exports of other data', async () => {
    for (const [m, u] of [['get', '/clinical-notes'], ['get', '/prescriptions'], ['get', '/lab-orders'], ['get', '/billing/invoices'], ['get', '/billing/patients']] as const) {
      expect((await call(m, u, 'PHARMACIST')).status).toBe(403);
    }
    expect((await call('post', '/prescriptions', 'PHARMACIST', {})).status).toBe(403);
  });
});

describe('BILLING', () => {
  it('runs billing: invoices, payments, patient lookup', async () => {
    expect((await call('get', '/billing/invoices', 'BILLING')).status).toBe(200);
    expect((await call('get', '/billing/patients?q=ali', 'BILLING')).status).toBe(200);
    expect((await call('post', '/billing/invoices', 'BILLING', { patientId: 'nope' })).status).toBe(400); // authorised, then validated
    expect((await call('post', `/billing/invoices/${ID}/payments`, 'BILLING', { amountMinor: 0, method: 'CASH' })).status).toBe(400);
  });

  it('the patient lookup is hospital-scoped, skips deleted patients and selects only id, name, code', async () => {
    await call('get', '/billing/patients?q=PT-1', 'BILLING');
    const arg = prismaMock.patient.findMany.mock.calls[0][0] as any;
    expect(arg.where.hospitalId).toBe('hosp-1');
    expect(arg.where.deletedAt).toBeNull();
    expect(arg.select).toEqual({ id: true, name: true, patientCode: true });
  });

  it('has no access to pharmacy stock, the catalogue or clinical records', async () => {
    for (const [m, u] of [['get', '/pharmacy/stock'], ['get', '/pharmacy/queue'], ['get', '/medications'], ['get', '/clinical-notes'], ['get', '/prescriptions']] as const) {
      expect((await call(m, u, 'BILLING')).status).toBe(403);
    }
    expect((await call('post', '/pharmacy/receive', 'BILLING', { medicationId: ID, quantity: 1 })).status).toBe(403);
    expect((await call('post', '/pharmacy/dispense', 'BILLING', { prescriptionItemId: ID, quantity: 1 })).status).toBe(403);
  });

  it('DOCTOR, NURSE and DISPATCHER still cannot reach the patient lookup', async () => {
    for (const r of ['DOCTOR', 'NURSE', 'DISPATCHER']) expect((await call('get', '/billing/patients', r)).status).toBe(403);
  });
});

describe('exports', () => {
  it('BILLING may reach billing exports only; PHARMACIST none (3 requests: the route has a 10/min limiter)', async () => {
    expect((await call('get', '/exports/patients', 'BILLING')).status).toBe(403);
    expect((await call('get', '/exports/billing', 'BILLING')).status).not.toBe(403);
    expect((await call('get', '/exports/billing', 'PHARMACIST')).status).toBe(403);
  });
});
