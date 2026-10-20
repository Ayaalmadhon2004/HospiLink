import express from 'express';
import request from 'supertest';

jest.mock('../../src/middlewares/auth.middleware', () => ({
  protect: (_req: any, _res: any, next: any) => next(),
  authorize: () => (_req: any, _res: any, next: any) => next(),
}));
jest.mock('../../src/middlewares/audit.middleware', () => ({
  logActivity: () => (_req: any, _res: any, next: any) => next(),
}));
// multipart body is not parsed here: the stub just passes through.
jest.mock('../../src/middlewares/upload.middleware', () => ({
  upload: { single: () => (_req: any, _res: any, next: any) => next() },
}));

jest.mock('../../src/controllers/patient.controller', () => {
  const echo = (status = 200) =>
    jest.fn((req: any, res: any) => res.status(status).json({ success: true, body: req.body, query: req.query, params: req.params }));
  return {
    admitPatient: echo(201),
    uploadReport: echo(201),
    getRecentPatients: echo(),
    getPatients: echo(),
    getPatientById: echo(),
    updatePatient: echo(),
    dischargePatient: echo(),
    getPatientReports: echo(),
    getAvailableBeds: echo(),
  };
});

import * as controller from '../../src/controllers/patient.controller';
import patientRoutes from '../../src/routes/patient.routes';

const app = express();
app.use(express.json());
app.use('/patients', patientRoutes);

const U1 = '3f2b8c1e-6f0a-4a57-9a39-1c1d8b3f7a10';
const U2 = '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d';

const admit = { name: 'Ahmad Khaled', age: 34, gender: 'MALE', department: 'Cardiology', diagnosis: 'Chest pain' };

beforeEach(() => jest.clearAllMocks());

describe('patient routes validation', () => {
  it('POST /patients/admit passes a valid body with unknown keys stripped', async () => {
    const res = await request(app).post('/patients/admit').send({ ...admit, bedId: U1, status: 'CRITICAL', patientCode: 'X', junk: 1 });
    expect(res.status).toBe(201);
    expect(res.body.body).toEqual({ ...admit, bedId: U1 });
  });

  it('POST /patients/admit with invalid body returns 400 and skips the controller', async () => {
    const res = await request(app).post('/patients/admit').send({ ...admit, age: -3, gender: 'OTHER', bedId: 'x' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.errors.map((e: any) => e.path)).toEqual(expect.arrayContaining(['body.age', 'body.gender', 'body.bedId']));
    expect(controller.admitPatient).not.toHaveBeenCalled();
  });

  it('PUT /patients/:id validates params and body, stripping mass-assignment keys', async () => {
    const ok = await request(app).put(`/patients/${U1}`).send({ name: 'New Name', age: 50, hospitalId: U2, patientCode: 'PT-1' });
    expect(ok.status).toBe(200);
    expect(ok.body.body).toEqual({ name: 'New Name', age: 50 });

    expect((await request(app).put('/patients/not-a-uuid').send({ name: 'New Name' })).status).toBe(400);
    expect((await request(app).put(`/patients/${U1}`).send({ status: 'DEAD' })).status).toBe(400);
    expect(controller.updatePatient).toHaveBeenCalledTimes(1);
  });

  it('PUT /patients/:id/discharge rejects non-uuid ids', async () => {
    expect((await request(app).put('/patients/abc/discharge')).status).toBe(400);
    expect(controller.dischargePatient).not.toHaveBeenCalled();
    expect((await request(app).put(`/patients/${U1}/discharge`)).status).toBe(200);
  });

  it('GET /patients validates and strips the query', async () => {
    const res = await request(app).get('/patients?status=All&department=Cardiology&page=2&limit=10&junk=1');
    expect(res.status).toBe(200);
    expect(res.body.query).toEqual({ department: 'Cardiology', page: '2', limit: '10' });

    const bad = await request(app).get('/patients?status=NOPE&page=-1');
    expect(bad.status).toBe(400);
    expect(controller.getPatients).toHaveBeenCalledTimes(1);
  });

  it('GET /patients/beds/available is not shadowed by /:id and strips query', async () => {
    const res = await request(app).get('/patients/beds/available?department=ICU&x=1');
    expect(res.status).toBe(200);
    expect(res.body.query).toEqual({ department: 'ICU' });
    expect(controller.getAvailableBeds).toHaveBeenCalledTimes(1);
    expect(controller.getPatientById).not.toHaveBeenCalled();
  });

  it('GET /patients/:id and /:id/reports reject non-uuid ids', async () => {
    expect((await request(app).get('/patients/abc')).status).toBe(400);
    expect((await request(app).get('/patients/abc/reports')).status).toBe(400);
    expect(controller.getPatientById).not.toHaveBeenCalled();
    expect(controller.getPatientReports).not.toHaveBeenCalled();
    expect((await request(app).get(`/patients/${U1}`)).status).toBe(200);
    expect((await request(app).get(`/patients/${U1}/reports`)).status).toBe(200);
  });

  it('POST /patients/:id/reports validates params only (multipart body untouched)', async () => {
    expect((await request(app).post('/patients/abc/reports')).status).toBe(400);
    expect(controller.uploadReport).not.toHaveBeenCalled();
    const ok = await request(app).post(`/patients/${U1}/reports`).field('anything', 'x');
    expect(ok.status).toBe(201);
    expect(ok.body.params).toEqual({ id: U1 });
  });
});
