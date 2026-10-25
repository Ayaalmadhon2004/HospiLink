import express from 'express';
import request from 'supertest';
import webVitalsRoutes, {
  getVitalsAggregate,
  resetVitalsAggregate,
} from '../../src/routes/webVitals.routes';

const buildApp = () => {
  const app = express();
  app.set('trust proxy', 1);
  app.use('/api/telemetry/web-vitals', webVitalsRoutes);
  return app;
};

const valid = { name: 'LCP', value: 1234.5, rating: 'good', path: '/patients/:id' };

describe('POST /api/telemetry/web-vitals', () => {
  beforeEach(() => resetVitalsAggregate());

  it('204 for a valid JSON body', async () => {
    const res = await request(buildApp()).post('/api/telemetry/web-vitals').send(valid);
    expect(res.status).toBe(204);
    expect(getVitalsAggregate()['LCP|/patients/:id|good']).toEqual({ count: 1, sum: 1234.5, max: 1234.5 });
  });

  it('204 for a text/plain body (sendBeacon)', async () => {
    const res = await request(buildApp())
      .post('/api/telemetry/web-vitals')
      .set('Content-Type', 'text/plain;charset=UTF-8')
      .send(JSON.stringify({ ...valid, id: 'v6-123-456' }));
    expect(res.status).toBe(204);
  });

  it('does not require authentication', async () => {
    const res = await request(buildApp()).post('/api/telemetry/web-vitals').send(valid);
    expect(res.status).not.toBe(401);
  });

  it.each([
    ['unknown metric', { ...valid, name: 'FOO' }],
    ['negative value', { ...valid, value: -1 }],
    ['non numeric value', { ...valid, value: '12' }],
    ['bad rating', { ...valid, rating: 'meh' }],
    ['query string in path', { ...valid, path: '/patients?name=John' }],
    ['hash in path', { ...valid, path: '/a#b' }],
    ['path without slash', { ...valid, path: 'patients' }],
    ['extra field (PII)', { ...valid, userId: 'u1' }],
    ['bad id', { ...valid, id: '<script>' }],
  ])('400 for %s', async (_label, body) => {
    const res = await request(buildApp()).post('/api/telemetry/web-vitals').send(body);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('400 for malformed JSON and empty body', async () => {
    const app = buildApp();
    expect(
      (await request(app).post('/api/telemetry/web-vitals').set('Content-Type', 'text/plain').send('{nope')).status,
    ).toBe(400);
    expect((await request(app).post('/api/telemetry/web-vitals')).status).toBe(400);
  });

  it('413 for a body above 1kb', async () => {
    const res = await request(buildApp())
      .post('/api/telemetry/web-vitals')
      .set('Content-Type', 'text/plain')
      .send('x'.repeat(2000));
    expect(res.status).toBe(413);
  });

  it('429 after the per-IP limit', async () => {
    const app = buildApp();
    let last = 204;
    for (let i = 0; i < 70; i += 1) {
      last = (await request(app).post('/api/telemetry/web-vitals').set('X-Forwarded-For', '9.9.9.9').send(valid)).status;
    }
    expect(last).toBe(429);
  });
});
