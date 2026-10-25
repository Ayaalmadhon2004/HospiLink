import { prismaMock } from '../mocks/prisma';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../../src/config/jwt';
import { pharmacyRouter, billingRouter } from '../../src/routes/pharmacyBilling.routes';

jest.mock('../../src/middlewares/audit.middleware', () => ({ logActivity: () => (_r: any, _s: any, n: any) => n() }));

const app = express();
app.use(express.json());
app.use('/pharmacy', pharmacyRouter);
app.use('/billing', billingRouter);

const ID = '3f2b8c1e-6f0a-4a57-9a39-1c1d8b3f7a10';
const as = (role: string) => {
  prismaMock.user.findUnique.mockResolvedValue({ id: 'u1', email: 'u@h.com', role, hospitalId: 'hosp-1', accountStatus: 'ACTIVE', name: 'N' } as any);
  return `Bearer ${jwt.sign({ userId: 'u1' }, JWT_SECRET)}`;
};
const call = (method: string, url: string, role: string, send: object = {}) => (request(app) as any)[method](url).set('Authorization', as(role)).send(send);

describe('billing is ADMIN-only', () => {
  it.each([
    ['get', '/billing/invoices'], ['get', `/billing/invoices/${ID}`], ['post', '/billing/invoices'],
    ['post', `/billing/invoices/${ID}/issue`], ['post', `/billing/invoices/${ID}/void`], ['post', `/billing/invoices/${ID}/payments`],
  ])('%s %s -> 401 anonymous, 403 for DOCTOR/NURSE/DISPATCHER', async (method, url) => {
    expect((await (request(app) as any)[method](url)).status).toBe(401);
    for (const r of ['DOCTOR', 'NURSE', 'DISPATCHER']) expect((await call(method, url, r)).status).toBe(403);
    expect(prismaMock.invoice.create).not.toHaveBeenCalled();
    expect(prismaMock.payment.create).not.toHaveBeenCalled();
  });

  it('validates money: no negative/fractional/zero amounts, unknown method', async () => {
    const base = `/billing/invoices/${ID}`;
    expect((await call('post', `${base}/lines`, 'ADMIN', { description: 'x', quantity: 0, unitPriceMinor: 5 })).status).toBe(400);
    expect((await call('post', `${base}/lines`, 'ADMIN', { description: 'x', quantity: 1, unitPriceMinor: -5 })).status).toBe(400);
    expect((await call('post', `${base}/lines`, 'ADMIN', { description: 'x', quantity: 1, unitPriceMinor: 1.5 })).status).toBe(400);
    expect((await call('post', `${base}/payments`, 'ADMIN', { amountMinor: 0, method: 'CASH' })).status).toBe(400);
    expect((await call('post', `${base}/payments`, 'ADMIN', { amountMinor: 10, method: 'BITCOIN' })).status).toBe(400);
    expect((await call('put', `${base}/discount`, 'ADMIN', { discountMinor: -1 })).status).toBe(400);
    expect((await call('post', '/billing/invoices', 'ADMIN', { patientId: 'nope' })).status).toBe(400);
    expect(prismaMock.invoiceLine.create).not.toHaveBeenCalled();
  });
});

describe('pharmacy access', () => {
  it('stock: DISPATCHER 403; receive/adjust/movements are ADMIN-only; dispense is ADMIN/DOCTOR/NURSE', async () => {
    expect((await call('get', '/pharmacy/stock', 'DISPATCHER')).status).toBe(403);
    for (const r of ['DOCTOR', 'NURSE']) {
      expect((await call('post', '/pharmacy/receive', r, { medicationId: ID, quantity: 5 })).status).toBe(403);
      expect((await call('post', '/pharmacy/adjust', r, { medicationId: ID, delta: -1, note: 'count' })).status).toBe(403);
      expect((await call('get', '/pharmacy/movements', r)).status).toBe(403);
    }
    expect((await call('post', '/pharmacy/dispense', 'DISPATCHER', { prescriptionItemId: ID, quantity: 1 })).status).toBe(403);
    prismaMock.prescriptionItem.findFirst.mockResolvedValue(null);
    expect((await call('post', '/pharmacy/dispense', 'NURSE', { prescriptionItemId: ID, quantity: 1 })).status).toBe(404); // authorised, item missing
  });

  it('validates quantities: positive integers, adjust needs a non-zero delta and a reason; stockQuantity is not settable', async () => {
    expect((await call('post', '/pharmacy/receive', 'ADMIN', { medicationId: ID, quantity: 0 })).status).toBe(400);
    expect((await call('post', '/pharmacy/receive', 'ADMIN', { medicationId: ID, quantity: 2.5 })).status).toBe(400);
    expect((await call('post', '/pharmacy/adjust', 'ADMIN', { medicationId: ID, delta: 0, note: 'because' })).status).toBe(400);
    expect((await call('post', '/pharmacy/adjust', 'ADMIN', { medicationId: ID, delta: -2 })).status).toBe(400);
    expect((await call('post', '/pharmacy/dispense', 'DOCTOR', { prescriptionItemId: ID, quantity: -1 })).status).toBe(400);
    expect(prismaMock.medication.updateMany).not.toHaveBeenCalled();
  });
});
