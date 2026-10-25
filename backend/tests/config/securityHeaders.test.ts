import { readFileSync } from 'fs';
import { join } from 'path';
import express from 'express';
import request from 'supertest';
import { helmetMiddleware, permissionsPolicy, noStore } from '../../src/config/securityHeaders';
import { errorEnvelope, fail } from '../../src/utils/apiResponse';
import { errorHandler } from '../../src/middlewares/error.middleware';

const build = () => {
  const app = express();
  app.use(helmetMiddleware());
  app.use(permissionsPolicy);
  app.use(errorEnvelope);
  app.use('/api', noStore);
  app.get('/api/data', (_req, res) => res.json({ ok: true }));
  app.get('/api/file', (_req, res) => {
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.send('x');
  });
  app.get('/api/boom', () => { throw Object.assign(new Error('secret connection string'), { stack: 'at /srv/app.js:1' }); });
  app.use('/api', (_req, res) => fail(res, 404, 'NOT_FOUND', 'Route not found'));
  app.use(errorHandler);
  return app;
};

describe('security headers (ZAP baseline findings)', () => {
  it('sends a locked-down CSP including the directives that have no default-src fallback', async () => {
    const res = await request(build()).get('/api/data');
    const csp = String(res.headers['content-security-policy']);
    expect(csp).toContain("default-src 'none'");
    expect(csp).toContain("base-uri 'none'");
    expect(csp).toContain("form-action 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
  });

  it('sets nosniff, HSTS, referrer, permissions policy and no X-Powered-By', async () => {
    const res = await request(build()).get('/api/data');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['strict-transport-security']).toMatch(/max-age=\d+/);
    expect(res.headers['referrer-policy']).toBe('no-referrer');
    expect(res.headers['permissions-policy']).toContain('camera=()');
    expect(res.headers['permissions-policy']).toContain('geolocation=()');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('marks API responses no-store (also error responses)', async () => {
    const app = build();
    expect((await request(app).get('/api/data')).headers['cache-control']).toBe('no-store');
    expect((await request(app).get('/api/nope')).headers['cache-control']).toBe('no-store');
  });

  it('lets a handler opt into private caching (report files)', async () => {
    const res = await request(build()).get('/api/file');
    expect(res.headers['cache-control']).toBe('private, max-age=3600');
  });

  it('answers unknown API routes with a JSON envelope, not an HTML page', async () => {
    const res = await request(build()).get('/api/nope');
    expect(res.status).toBe(404);
    expect(res.headers['content-type']).toMatch(/json/);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('does not leak internal error messages or stack traces', async () => {
    const res = await request(build()).get('/api/boom');
    expect(res.status).toBe(500);
    expect(JSON.stringify(res.body)).not.toMatch(/secret connection string|app\.js/);
  });
});

describe('frontend/vercel.json hosting headers', () => {
  const cfg = JSON.parse(readFileSync(join(__dirname, '../../../frontend/vercel.json'), 'utf8')) as {
    headers: { source: string; headers: { key: string; value: string }[] }[];
  };
  const all = Object.fromEntries(cfg.headers.find((h) => h.source === '/(.*)')!.headers.map((h) => [h.key, h.value]));

  it('sets a CSP without unsafe-inline scripts/eval and with no-fallback directives', () => {
    const csp = all['Content-Security-Policy'];
    expect(csp).toMatch(/script-src 'self'(;|$)/);
    expect(csp).not.toMatch(/unsafe-eval/);
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
  });

  it('sets the remaining hardening headers', () => {
    expect(all['Strict-Transport-Security']).toMatch(/max-age=\d{7,}/);
    expect(all['X-Content-Type-Options']).toBe('nosniff');
    expect(all['X-Frame-Options']).toBe('DENY');
    expect(all['Referrer-Policy']).toBeDefined();
    expect(all['Permissions-Policy']).toContain('camera=()');
  });
});
