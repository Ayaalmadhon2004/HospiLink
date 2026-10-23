// Real protect/authorize/validate + real controller (Prisma mocked) for GET /patients/flow.
import { prismaMock } from '../mocks/prisma';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../../src/config/jwt';
import patientRoutes from '../../src/routes/patient.routes';

jest.mock('../../src/middlewares/audit.middleware', () => ({
  logActivity: () => (_req: any, _res: any, next: any) => next(),
}));

const app = express();
app.use(express.json());
app.use('/patients', patientRoutes);

const asRole = (role: string) => {
  prismaMock.user.findUnique.mockResolvedValue({ id: 'u1', email: 'u@h.com', role } as any);
  return `Bearer ${jwt.sign({ userId: 'u1' }, JWT_SECRET)}`;
};

describe('GET /patients/flow', () => {
  it('returns 401 without a token', async () => {
    const res = await request(app).get('/patients/flow');
    expect(res.status).toBe(401);
    expect(prismaMock.patient.findMany).not.toHaveBeenCalled();
  });

  it('returns 403 for DISPATCHER', async () => {
    const res = await request(app).get('/patients/flow').set('Authorization', asRole('DISPATCHER'));
    expect(res.status).toBe(403);
  });

  it.each(['0', '31', 'abc'])('returns 400 for days=%s', async (days) => {
    const res = await request(app).get(`/patients/flow?days=${days}`).set('Authorization', asRole('ADMIN'));
    expect(res.status).toBe(400);
    expect(prismaMock.patient.findMany).not.toHaveBeenCalled();
  });

  it.each(['ADMIN', 'DOCTOR', 'NURSE'])('returns one bucket per day for %s', async (role) => {
    prismaMock.patient.findMany.mockResolvedValue([]);
    const res = await request(app).get('/patients/flow?days=5').set('Authorization', asRole(role));
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(5);
  });

  it('is not shadowed by /patients/:id', async () => {
    prismaMock.patient.findMany.mockResolvedValue([]);
    const res = await request(app).get('/patients/flow').set('Authorization', asRole('ADMIN'));
    expect(res.status).toBe(200);
    expect(prismaMock.patient.findUnique).not.toHaveBeenCalled();
  });
});
