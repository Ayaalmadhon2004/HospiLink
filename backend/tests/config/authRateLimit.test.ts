import express from 'express';
import request from 'supertest';
import { createAuthLimiter, createMeLimiter } from '../../src/config/authRateLimit';

const buildApp = () => {
  const app = express();
  app.use('/api/auth', createMeLimiter());
  app.use('/api/auth', createAuthLimiter());
  app.get('/api/auth/me', (_req, res) => res.json({ ok: true }));
  app.post('/api/auth/login', (_req, res) => res.json({ ok: true }));
  return app;
};

describe('auth rate limiters', () => {
  it('does not count GET /me against the strict auth limit (20 / 15 min)', async () => {
    const app = buildApp();
    for (let i = 0; i < 30; i++) {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(200);
    }
    // the strict budget is untouched, login still works
    expect((await request(app).post('/api/auth/login')).status).toBe(200);
  });

  it('still limits login after 20 attempts', async () => {
    const app = buildApp();
    for (let i = 0; i < 20; i++) {
      expect((await request(app).post('/api/auth/login')).status).toBe(200);
    }
    expect((await request(app).post('/api/auth/login')).status).toBe(429);
  });

  it('limits /me on its own (120 / min), never unlimited', async () => {
    const app = buildApp();
    for (let i = 0; i < 120; i++) {
      await request(app).get('/api/auth/me');
    }
    expect((await request(app).get('/api/auth/me')).status).toBe(429);
  });
});
