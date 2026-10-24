// Real protect/authorize/validate + real controllers (Prisma mocked): a PENDING account is locked out of
// clinical data, and only an ADMIN can reach the account-approval API.
import { prismaMock } from '../mocks/prisma';
import '../mocks/io';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../../src/config/jwt';
import patientRoutes from '../../src/routes/patient.routes';
import vitalsRoutes from '../../src/routes/vitals.routes';
import bedRoutes from '../../src/routes/bed.routes';
import usersRoutes from '../../src/routes/users.routes';
import staffRoutes from '../../src/routes/staff.routes';
import dispatchRoutes from '../../src/routes/dispatch.routes';

jest.mock('../../src/middlewares/audit.middleware', () => ({
  logActivity: () => (_req: any, _res: any, next: any) => next(),
}));

const app = express();
app.use(express.json());
app.use('/patients', patientRoutes);
app.use('/vitals', vitalsRoutes);
app.use('/beds', bedRoutes);
app.use('/users', usersRoutes);
app.use('/staff', staffRoutes);
app.use('/dispatch', dispatchRoutes);

const U1 = '3f2b8c1e-6f0a-4a57-9a39-1c1d8b3f7a10';

const as = (role: string, accountStatus: string, hospitalId = 'hosp-1') => {
  prismaMock.user.findUnique.mockResolvedValue({ id: 'u1', email: 'u@h.com', role, hospitalId, accountStatus } as any);
  return `Bearer ${jwt.sign({ userId: 'u1' }, JWT_SECRET)}`;
};

describe('PENDING / DISABLED accounts', () => {
  it.each([
    ['GET', '/patients'],
    ['GET', `/patients/${U1}`],
    ['GET', '/vitals'],
    ['GET', '/beds'],
    ['POST', '/vitals'],
    ['POST', '/patients/admit'],
  ])('%s %s -> 403 "Account pending admin approval" for a PENDING NURSE', async (method, url) => {
    const res = await (request(app) as any)[method.toLowerCase()](url).set('Authorization', as('NURSE', 'PENDING')).send({});
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Account pending admin approval');
    expect(res.body.code).toBe('ACCOUNT_PENDING');
    expect(prismaMock.patient.findMany).not.toHaveBeenCalled();
    expect(prismaMock.patient.create).not.toHaveBeenCalled();
    expect(prismaMock.patientVitals.findMany).not.toHaveBeenCalled();
    expect(prismaMock.bed.findMany).not.toHaveBeenCalled();
  });

  it('a DISABLED account is also blocked', async () => {
    const res = await request(app).get('/patients').set('Authorization', as('DOCTOR', 'DISABLED'));
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('ACCOUNT_DISABLED');
  });

  it('an ACTIVE account reads patients of its own hospital only', async () => {
    prismaMock.patient.findMany.mockResolvedValue([]);
    prismaMock.patient.count.mockResolvedValue(0);
    const res = await request(app).get('/patients').set('Authorization', as('NURSE', 'ACTIVE'));
    expect(res.status).toBe(200);
    expect(prismaMock.patient.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { hospitalId: 'hosp-1' } })
    );
  });
});

describe('/users (account administration)', () => {
  it.each(['DOCTOR', 'NURSE', 'DISPATCHER'])('%s cannot approve or invite (403)', async (role) => {
    const auth = as(role, 'ACTIVE');
    const approve = await request(app).put(`/users/${U1}/approve`).set('Authorization', auth).send({ role: 'ADMIN' });
    const invite = await request(app).post('/users').set('Authorization', auth).send({});
    const list = await request(app).get('/users').set('Authorization', auth);
    expect(approve.status).toBe(403);
    expect(invite.status).toBe(403);
    expect(list.status).toBe(403);
    expect(prismaMock.user.update).not.toHaveBeenCalled();
    expect(prismaMock.user.create).not.toHaveBeenCalled();
  });

  it('a PENDING user cannot approve themselves, even if their stored role is ADMIN', async () => {
    const res = await request(app).put(`/users/${U1}/approve`).set('Authorization', as('ADMIN', 'PENDING')).send({ role: 'ADMIN' });
    expect(res.status).toBe(403);
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it('ADMIN approves a pending user of their hospital', async () => {
    const auth = as('ADMIN', 'ACTIVE');
    prismaMock.user.findFirst.mockResolvedValue({ id: U1, accountStatus: 'PENDING' } as any);
    prismaMock.user.update.mockResolvedValue({ id: U1, accountStatus: 'ACTIVE', role: 'DOCTOR' } as any);

    const res = await request(app).put(`/users/${U1}/approve`).set('Authorization', auth).send({ role: 'DOCTOR', hospitalId: 'x' });

    expect(res.status).toBe(200);
    expect(prismaMock.user.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: U1, hospitalId: 'hosp-1' } }));
  });

  it('approve requires an explicit valid role (400)', async () => {
    const auth = as('ADMIN', 'ACTIVE');
    const none = await request(app).put(`/users/${U1}/approve`).set('Authorization', auth).send({});
    const bad = await request(app).put(`/users/${U1}/approve`).set('Authorization', auth).send({ role: 'SUPERUSER' });
    expect(none.status).toBe(400);
    expect(bad.status).toBe(400);
  });

  it('invite validates the body and ignores hospitalId', async () => {
    const auth = as('ADMIN', 'ACTIVE');
    prismaMock.user.findUnique.mockResolvedValueOnce({ id: 'u1', email: 'u@h.com', role: 'ADMIN', hospitalId: 'hosp-1', accountStatus: 'ACTIVE' } as any);
    prismaMock.user.findUnique.mockResolvedValueOnce(null);
    prismaMock.user.create.mockResolvedValue({ id: 'new' } as any);

    const res = await request(app).post('/users').set('Authorization', auth).send({
      email: 'n@h.com', password: 'secret123', name: 'New Nurse', role: 'NURSE', department: 'ER', shift: 'DAY', hospitalId: 'other',
    });

    expect(res.status).toBe(201);
    expect((prismaMock.user.create.mock.calls[0][0] as any).data.hospitalId).toBe('hosp-1');
  });
});

describe('PUT /staff/:id/login (link a login to a staff member)', () => {
  it.each(['DOCTOR', 'NURSE', 'DISPATCHER'])('is ADMIN only: %s -> 403', async (role) => {
    const res = await request(app).put(`/staff/${U1}/login`).set('Authorization', as(role, 'ACTIVE')).send({ userId: null });
    expect(res.status).toBe(403);
    expect(prismaMock.staff.update).not.toHaveBeenCalled();
  });

  it('validates the body (400) before touching the database', async () => {
    const res = await request(app).put(`/staff/${U1}/login`).set('Authorization', as('ADMIN', 'ACTIVE')).send({ userId: 'nope' });
    expect(res.status).toBe(400);
    expect(prismaMock.staff.update).not.toHaveBeenCalled();
  });

  it('an ADMIN can unlink', async () => {
    const authz = as('ADMIN', 'ACTIVE');
    prismaMock.staff.findFirst.mockResolvedValue({ id: U1 } as any);
    prismaMock.staff.update.mockResolvedValue({ id: U1, userId: null } as any);
    const res = await request(app).put(`/staff/${U1}/login`).set('Authorization', authz).send({ userId: null });
    expect(res.status).toBe(200);
    expect(res.body.data.hasLogin).toBe(false);
  });
});

describe('POST /users/:id/2fa/reset', () => {
  it.each(['DOCTOR', 'NURSE', 'DISPATCHER'])('is ADMIN only: %s -> 403', async (role) => {
    const res = await request(app).post(`/users/${U1}/2fa/reset`).set('Authorization', as(role, 'ACTIVE'));
    expect(res.status).toBe(403);
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });
});

describe('dispatch lifecycle routes', () => {
  it.each([
    ['POST', '/dispatch/units'],
    ['PUT', `/dispatch/units/${U1}`],
    ['DELETE', `/dispatch/units/${U1}`],
    ['POST', `/dispatch/calls/${U1}/complete`],
    ['POST', `/dispatch/calls/${U1}/cancel`],
  ])('%s %s is forbidden to a NURSE', async (method, url) => {
    const res = await (request(app) as any)[method.toLowerCase()](url).set('Authorization', as('NURSE', 'ACTIVE')).send({});
    expect(res.status).toBe(403);
  });

  it('deleting a unit is ADMIN only (a DISPATCHER gets 403)', async () => {
    const res = await request(app).delete(`/dispatch/units/${U1}`).set('Authorization', as('DISPATCHER', 'ACTIVE'));
    expect(res.status).toBe(403);
    expect(prismaMock.dispatchUnit.deleteMany).not.toHaveBeenCalled();
  });

  it('a DISPATCHER can create a unit and close a call; bad input is rejected with 400', async () => {
    const authz = as('DISPATCHER', 'ACTIVE');
    prismaMock.dispatchUnit.create.mockResolvedValue({ id: 'u9' } as any);
    const ok = await request(app).post('/dispatch/units').set('Authorization', authz).send({ unitCode: 'AMB-9', unitType: 'AMBULANCE' });
    expect(ok.status).toBe(201);

    const bad = await request(app).post('/dispatch/units').set('Authorization', authz).send({ unitCode: 'AMB-9', unitType: 'TANK' });
    expect(bad.status).toBe(400);

    const badId = await request(app).post('/dispatch/calls/not-a-uuid/complete').set('Authorization', authz);
    expect(badId.status).toBe(400);
  });
});

describe('vitals thresholds routes', () => {
  it('reading is for clinical roles; DISPATCHER gets 403', async () => {
    const res = await request(app).get('/vitals/thresholds').set('Authorization', as('DISPATCHER', 'ACTIVE'));
    expect(res.status).toBe(403);
  });

  it.each(['NURSE', 'DISPATCHER'])('changing thresholds needs a DOCTOR or ADMIN: %s -> 403', async (role) => {
    const authz = as(role, 'ACTIVE');
    const put = await request(app).put('/vitals/thresholds').set('Authorization', authz).send({ department: 'ICU', vitalType: 'SPO2' });
    const del = await request(app).delete(`/vitals/thresholds/${U1}`).set('Authorization', authz);
    expect(put.status).toBe(403);
    expect(del.status).toBe(403);
    expect(prismaMock.vitalThresholds.upsert).not.toHaveBeenCalled();
  });

  it('a DOCTOR can save a threshold; disordered limits are a 400; /thresholds is not swallowed by /:id', async () => {
    const authz = as('DOCTOR', 'ACTIVE');
    prismaMock.vitalThresholds.upsert.mockResolvedValue({ id: 't1' } as any);
    const ok = await request(app).put('/vitals/thresholds').set('Authorization', authz).send({ department: 'ICU', vitalType: 'SPO2', minCritical: 88 });
    expect(ok.status).toBe(200);
    const bad = await request(app).put('/vitals/thresholds').set('Authorization', authz).send({ department: 'ICU', vitalType: 'SPO2', minCritical: 99, maxCritical: 90 });
    expect(bad.status).toBe(400);

    prismaMock.vitalThresholds.findMany.mockResolvedValue([] as any);
    const list = await request(app).get('/vitals/thresholds').set('Authorization', authz);
    expect(list.status).toBe(200);
    expect(prismaMock.patientVitals.findFirst).not.toHaveBeenCalled();
  });
});
