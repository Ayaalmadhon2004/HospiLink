import express from 'express';
import request from 'supertest';

jest.mock('../../src/middlewares/auth.middleware', () => ({
  protect: (_req: any, _res: any, next: any) => next(),
  authorize: () => (_req: any, _res: any, next: any) => next(),
}));
jest.mock('../../src/middlewares/audit.middleware', () => ({
  logActivity: () => (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../src/controllers/bed.controller', () => ({
  getAllBeds: jest.fn(), getBedById: jest.fn(), updateBedStatus: jest.fn(), deleteBed: jest.fn(),
  createBed: jest.fn((req: any, res: any) => res.status(201).json({ success: true, body: req.body })),
}));
jest.mock('../../src/controllers/vitals.controller', () => ({
  recordVitals: jest.fn((req: any, res: any) => res.status(201).json({ success: true, body: req.body })),
  getVitals: jest.fn((req: any, res: any) => res.status(200).json({ success: true, query: req.query })),
  getCriticalAlerts: jest.fn(), getVitalsById: jest.fn(), updateVitals: jest.fn(), deleteVitals: jest.fn(),
}));
jest.mock('../../src/controllers/settings.controller', () => ({
  getUserSettings: jest.fn(), updateProfile: jest.fn(), updateNotifications: jest.fn(), updateSecurity: jest.fn(),
  updateDisplay: jest.fn((req: any, res: any) => res.status(200).json({ success: true, body: req.body })),
}));
jest.mock('../../src/controllers/notifications.controller', () => ({
  getNotifications: jest.fn(), markAllAsRead: jest.fn(), deleteNotification: jest.fn(),
  markAsRead: jest.fn((req: any, res: any) => res.status(200).json({ success: true, id: req.params.id })),
}));

import { createBed } from '../../src/controllers/bed.controller';
import bedRoutes from '../../src/routes/bed.routes';
import vitalsRoutes from '../../src/routes/vitals.routes';
import settingsRoutes from '../../src/routes/settings.routes';
import notificationRoutes from '../../src/routes/notifications.routes';

const app = express();
app.use(express.json());
app.use('/beds', bedRoutes);
app.use('/vitals', vitalsRoutes);
app.use('/settings', settingsRoutes);
app.use('/notifications', notificationRoutes);

const U1 = '3f2b8c1e-6f0a-4a57-9a39-1c1d8b3f7a10';
const U2 = '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d';

describe('validation on routes', () => {
  it('POST /beds with valid body reaches controller (extra keys stripped)', async () => {
    const res = await request(app).post('/beds').send({ bedNumber: 'A1', wardId: U1, hospitalId: U2, status: 'AVAILABLE', junk: 1 });
    expect(res.status).toBe(201);
    expect(res.body.body).toEqual({ bedNumber: 'A1', wardId: U1, hospitalId: U2, status: 'AVAILABLE' });
  });

  it('POST /beds with invalid body returns 400 and skips controller', async () => {
    (createBed as jest.Mock).mockClear();
    const res = await request(app).post('/beds').send({ bedNumber: '', wardId: 'x' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(Array.isArray(res.body.errors)).toBe(true);
    expect(createBed).not.toHaveBeenCalled();
  });

  it('POST /vitals rejects out-of-range spO2', async () => {
    expect((await request(app).post('/vitals').send({ patientId: U1, spO2: 500 })).status).toBe(400);
  });

  it('POST /vitals coerces numeric strings', async () => {
    const res = await request(app).post('/vitals').send({ patientId: U1, heartRate: '72' });
    expect(res.status).toBe(201);
    expect(res.body.body.heartRate).toBe(72);
  });

  it('GET /vitals validates and strips the query string', async () => {
    expect((await request(app).get('/vitals?critical=maybe')).status).toBe(400);
    const res = await request(app).get(`/vitals?patientId=${U1}&limit=20&junk=1`);
    expect(res.status).toBe(200);
    expect(res.body.query).toEqual({ patientId: U1, limit: '20' });
  });

  it('PUT /settings/display validates theme', async () => {
    expect((await request(app).put('/settings/display').send({ theme: 'neon' })).status).toBe(400);
    expect((await request(app).put('/settings/display').send({ theme: 'dark' })).status).toBe(200);
  });

  it('PUT /notifications/:id/read rejects non-uuid ids', async () => {
    expect((await request(app).put('/notifications/abc/read')).status).toBe(400);
    expect((await request(app).put(`/notifications/${U1}/read`)).status).toBe(200);
  });
});
