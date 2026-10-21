import { prismaMock } from '../mocks/prisma';
import '../mocks/io';
import express from 'express';
import request from 'supertest';
import internalRoutes from '../../src/routes/internal.routes';

const app = express();
app.use('/internal', internalRoutes);

describe('POST /internal/run-reminders', () => {
  const OLD = process.env.REMINDERS_CRON_SECRET;
  beforeEach(() => {
    prismaMock.shift.findMany.mockResolvedValue([]);
    prismaMock.appointment.findMany.mockResolvedValue([]);
  });
  afterEach(() => {
    if (OLD === undefined) delete process.env.REMINDERS_CRON_SECRET;
    else process.env.REMINDERS_CRON_SECRET = OLD;
  });

  it('404 when the secret is not configured', async () => {
    delete process.env.REMINDERS_CRON_SECRET;
    expect((await request(app).post('/internal/run-reminders').set('x-reminders-secret', 'x')).status).toBe(404);
  });
  it('401 with a missing or wrong secret', async () => {
    process.env.REMINDERS_CRON_SECRET = 's3cret';
    expect((await request(app).post('/internal/run-reminders')).status).toBe(401);
    expect((await request(app).post('/internal/run-reminders').set('x-reminders-secret', 'nope')).status).toBe(401);
  });
  it('200 with the right secret', async () => {
    process.env.REMINDERS_CRON_SECRET = 's3cret';
    const res = await request(app).post('/internal/run-reminders').set('x-reminders-secret', 's3cret');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: { shifts: 0, appointments: 0 } });
  });
});
