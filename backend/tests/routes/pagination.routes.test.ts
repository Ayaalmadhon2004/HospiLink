// Real protect/validate + real controllers (Prisma mocked): every list endpoint pages with page/limit.
import { prismaMock } from '../mocks/prisma';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../../src/config/jwt';
import bedRoutes from '../../src/routes/bed.routes';
import staffRoutes from '../../src/routes/staff.routes';
import appointmentRoutes from '../../src/routes/appointments.routes';
import vitalsRoutes from '../../src/routes/vitals.routes';
import notificationRoutes from '../../src/routes/notifications.routes';

jest.mock('../../src/middlewares/audit.middleware', () => ({
  logActivity: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

const app = express();
app.use(express.json());
app.use('/beds', bedRoutes);
app.use('/staff', staffRoutes);
app.use('/appointments', appointmentRoutes);
app.use('/vitals', vitalsRoutes);
app.use('/notifications', notificationRoutes);

const auth = () => {
  prismaMock.user.findUnique.mockResolvedValue({ id: 'u1', email: 'u@h.com', role: 'ADMIN', hospitalId: 'hosp-1', accountStatus: 'ACTIVE' } as never);
  return `Bearer ${jwt.sign({ userId: 'u1' }, JWT_SECRET)}`;
};

const cases: Array<[string, string, () => { findMany: jest.Mock; count: jest.Mock }]> = [
  ['/beds', 'beds', () => prismaMock.bed],
  ['/staff', 'staff', () => prismaMock.staff],
  ['/staff/shifts', 'shifts', () => prismaMock.shift],
  ['/appointments', 'appointments', () => prismaMock.appointment],
  ['/vitals', 'vitals', () => prismaMock.patientVitals],
  ['/notifications', 'notifications', () => prismaMock.notification],
];

describe.each(cases)('GET %s pagination (%s)', (path, _name, model) => {
  beforeEach(() => {
    model().findMany.mockResolvedValue([]);
    model().count.mockResolvedValue(95);
  });

  it('applies page/limit and returns the pagination block', async () => {
    const res = await request(app).get(`${path}?page=2&limit=20`).set('Authorization', auth());
    expect(res.status).toBe(200);
    expect(model().findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 20, take: 20 }));
    expect(res.body.pagination).toEqual({ page: 2, limit: 20, totalCount: 95, totalPages: 5, hasNextPage: true, hasPrevPage: true });
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  // Notifications keep their stricter schema: limit above 200 is a 400, everywhere else it is clamped.
  it('caps limit at 200', async () => {
    const res = await request(app).get(`${path}?limit=5000`).set('Authorization', auth());
    if (path === '/notifications') {
      expect(res.status).toBe(400);
      return;
    }
    expect(res.status).toBe(200);
    expect(model().findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 0, take: 200 }));
  });

  it('rejects a non-numeric page with 400', async () => {
    const res = await request(app).get(`${path}?page=abc`).set('Authorization', auth());
    expect(res.status).toBe(400);
    expect(model().findMany).not.toHaveBeenCalled();
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).get(path);
    expect(res.status).toBe(401);
  });
});
