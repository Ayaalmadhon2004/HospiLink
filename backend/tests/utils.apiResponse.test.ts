import express from 'express';
import request from 'supertest';
import { errorEnvelope, toErrorBody, fail, ok } from '../src/utils/apiResponse';

describe('toErrorBody', () => {
  it('leaves success bodies and non-errors untouched', () => {
    const body = { success: true, data: [1] };
    expect(toErrorBody(200, body)).toBe(body);
    expect(toErrorBody(500, 'text')).toBe('text');
    expect(toErrorBody(200, { success: false, message: 'x' })).toEqual({ success: false, message: 'x' }); // status < 400
  });

  it('turns { success:false, message } into the unified shape with a status-based code', () => {
    expect(toErrorBody(404, { success: false, message: 'Nope' })).toEqual({
      success: false, message: 'Nope', code: 'NOT_FOUND', error: { code: 'NOT_FOUND', message: 'Nope' },
    });
    expect((toErrorBody(409, { success: false, message: 'x' }) as { code: string }).code).toBe('CONFLICT');
    expect((toErrorBody(500, { success: false, message: 'x' }) as { code: string }).code).toBe('INTERNAL_ERROR');
    expect((toErrorBody(429, { success: false, message: 'x' }) as { code: string }).code).toBe('RATE_LIMITED');
  });

  it('keeps an explicit code and moves validation errors into details', () => {
    const out = toErrorBody(400, { success: false, code: 'PATIENT_NOT_FOUND', message: 'm', errors: [{ path: 'a', message: 'b' }] }) as {
      error: { code: string; details: unknown };
    };
    expect(out.error).toEqual({ code: 'PATIENT_NOT_FOUND', message: 'm', details: [{ path: 'a', message: 'b' }] });
  });

  it('converts the legacy { error: "text" } body', () => {
    expect(toErrorBody(401, { error: 'Unauthorized' })).toEqual({
      success: false, message: 'Unauthorized', code: 'UNAUTHORIZED', error: { code: 'UNAUTHORIZED', message: 'Unauthorized' },
    });
  });

  it('does not touch a body that is already unified', () => {
    const body = { success: false, error: { code: 'X', message: 'y' } };
    expect(toErrorBody(400, body)).toBe(body);
  });
});

describe('errorEnvelope middleware', () => {
  const app = express();
  app.use(errorEnvelope);
  app.get('/legacy', (_req, res) => { res.status(404).json({ success: false, message: 'Missing' }); });
  app.get('/fail', (_req, res) => { fail(res, 409, 'CONFLICT', 'Taken'); });
  app.get('/ok', (_req, res) => { ok(res, { a: 1 }); });

  it('normalises legacy failures from any route', async () => {
    const res = await request(app).get('/legacy');
    expect(res.status).toBe(404);
    expect(res.body.error).toEqual({ code: 'NOT_FOUND', message: 'Missing' });
  });

  it('is idempotent for fail() and leaves ok() alone', async () => {
    expect((await request(app).get('/fail')).body.error).toEqual({ code: 'CONFLICT', message: 'Taken' });
    expect((await request(app).get('/ok')).body).toEqual({ success: true, data: { a: 1 } });
  });
});
