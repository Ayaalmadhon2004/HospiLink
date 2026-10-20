// Real protect/authorize + real controller (Prisma mocked): checks 401/403/200 end to end.
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

describe('GET /patients/critical-count', () => {
  it('returns 401 without a token', async () => {
    const res = await request(app).get('/patients/critical-count');
    expect(res.status).toBe(401);
    expect(prismaMock.patient.count).not.toHaveBeenCalled();
  });

  it('returns 403 for DISPATCHER', async () => {
    const res = await request(app).get('/patients/critical-count').set('Authorization', asRole('DISPATCHER'));
    expect(res.status).toBe(403);
    expect(prismaMock.patient.count).not.toHaveBeenCalled();
  });

  it.each(['ADMIN', 'DOCTOR', 'NURSE'])('returns { success, data: { count } } for %s', async (role) => {
    prismaMock.patient.count.mockResolvedValue(3);
    const res = await request(app).get('/patients/critical-count').set('Authorization', asRole(role));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: { count: 3 } });
    expect(prismaMock.patient.count).toHaveBeenCalledWith({ where: { status: 'CRITICAL' } });
  });
});
