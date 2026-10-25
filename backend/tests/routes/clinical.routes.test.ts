// Real protect/authorize/validate + real controllers (Prisma mocked): who may read/write which clinical record.
import { prismaMock } from '../mocks/prisma';
import '../mocks/io';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../../src/config/jwt';
import { notesRouter, medicationsRouter, prescriptionsRouter, labOrdersRouter } from '../../src/routes/clinical.routes';

jest.mock('../../src/middlewares/audit.middleware', () => ({ logActivity: () => (_r: any, _s: any, n: any) => n() }));
jest.mock('../../src/services/notification.service', () => ({ notify: jest.fn().mockResolvedValue([]) }));

const app = express();
app.use(express.json());
app.use('/clinical-notes', notesRouter);
app.use('/medications', medicationsRouter);
app.use('/prescriptions', prescriptionsRouter);
app.use('/lab-orders', labOrdersRouter);

const ID = '3f2b8c1e-6f0a-4a57-9a39-1c1d8b3f7a10';
const as = (role: string) => {
  prismaMock.user.findUnique.mockResolvedValue({ id: 'u1', email: 'u@h.com', role, hospitalId: 'hosp-1', accountStatus: 'ACTIVE', name: 'N' } as any);
  return `Bearer ${jwt.sign({ userId: 'u1' }, JWT_SECRET)}`;
};
const call = (method: string, url: string, role: string, send: object = {}) => (request(app) as any)[method](url).set('Authorization', as(role)).send(send);

describe('clinical record access', () => {
  it.each([
    ['get', `/clinical-notes?patientId=${ID}`], ['get', `/prescriptions?patientId=${ID}`],
    ['get', `/lab-orders?patientId=${ID}`], ['get', '/medications'],
  ])('%s %s: DISPATCHER -> 403, anonymous -> 401', async (method, url) => {
    expect((await call(method, url, 'DISPATCHER')).status).toBe(403);
    expect((await (request(app) as any)[method](url)).status).toBe(401);
  });

  it('reads are open to ADMIN, DOCTOR and NURSE', async () => {
    prismaMock.clinicalNote.findMany.mockResolvedValue([]);
    prismaMock.clinicalNote.count.mockResolvedValue(0);
    for (const r of ['ADMIN', 'DOCTOR', 'NURSE']) expect((await call('get', `/clinical-notes?patientId=${ID}`, r)).status).toBe(200);
  });

  it('writes: prescriptions and lab orders are DOCTOR-only', async () => {
    const rx = { patientId: ID, items: [{ medicationId: ID, dose: '1', frequency: 'QD' }] };
    for (const r of ['ADMIN', 'NURSE', 'DISPATCHER']) {
      expect((await call('post', '/prescriptions', r, rx)).status).toBe(403);
      expect((await call('post', '/lab-orders', r, { patientId: ID, testName: 'CBC' })).status).toBe(403);
      expect((await call('put', `/prescriptions/${ID}/status`, r, { status: 'CANCELLED' })).status).toBe(403);
    }
    expect(prismaMock.prescription.create).not.toHaveBeenCalled();
    expect(prismaMock.labOrder.create).not.toHaveBeenCalled();
  });

  it('notes: ADMIN cannot write; medications catalogue: NURSE cannot write', async () => {
    expect((await call('post', '/clinical-notes', 'ADMIN', { patientId: ID, type: 'PROGRESS', content: 'x' })).status).toBe(403);
    expect((await call('post', '/medications', 'NURSE', { name: 'A', form: 'tab', strength: '1 mg' })).status).toBe(403);
    expect((await call('put', `/medications/${ID}`, 'NURSE', { active: false })).status).toBe(403);
  });

  it('lab results: DOCTOR and NURSE may enter them, ADMIN may not', async () => {
    expect((await call('post', `/lab-orders/${ID}/results`, 'ADMIN', { results: [{ analyte: 'Hb', value: 1 }] })).status).toBe(403);
    prismaMock.labOrder.findFirst.mockResolvedValue(null);
    expect((await call('post', `/lab-orders/${ID}/results`, 'NURSE', { results: [{ analyte: 'Hb', value: 1 }] })).status).toBe(404); // passed authz, order missing
  });
});

describe('clinical record validation', () => {
  it('400: missing patientId, bad note type, empty content, empty prescription, result without value, unknown status', async () => {
    expect((await call('get', '/clinical-notes', 'DOCTOR')).status).toBe(400);
    expect((await call('post', '/clinical-notes', 'DOCTOR', { patientId: ID, type: 'GOSSIP', content: 'x' })).status).toBe(400);
    expect((await call('post', '/clinical-notes', 'DOCTOR', { patientId: ID, type: 'PROGRESS', content: '  ' })).status).toBe(400);
    expect((await call('post', '/prescriptions', 'DOCTOR', { patientId: ID, items: [] })).status).toBe(400);
    expect((await call('post', `/lab-orders/${ID}/results`, 'DOCTOR', { results: [{ analyte: 'Hb' }] })).status).toBe(400);
    expect((await call('put', `/prescriptions/${ID}/status`, 'DOCTOR', { status: 'ACTIVE' })).status).toBe(400);
    expect(prismaMock.clinicalNote.create).not.toHaveBeenCalled();
  });

  it('note type is tolerant of case ("progress") and a client hospitalId/authorName is stripped', async () => {
    prismaMock.patient.findFirst.mockResolvedValue({ id: ID } as any);
    prismaMock.clinicalNote.create.mockResolvedValue({ id: 'n1' } as any);
    const res = await call('post', '/clinical-notes', 'DOCTOR', { patientId: ID, type: 'progress', content: 'ok', hospitalId: 'evil', authorName: 'Fake' });
    expect(res.status).toBe(201);
    expect(prismaMock.clinicalNote.create.mock.calls[0][0].data).toMatchObject({ type: 'PROGRESS', hospitalId: 'hosp-1', authorName: 'N' });
  });
});
