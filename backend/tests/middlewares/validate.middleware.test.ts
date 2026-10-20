import { z } from 'zod';
import { validate } from '../../src/middlewares/validate.middleware';
import { mockRequest, mockResponse, mockNext } from '../mocks/http';

describe('validate middleware', () => {
  const schema = z.object({ name: z.string().min(2) });

  it('calls next and replaces body with stripped data', () => {
    const req = mockRequest({ body: { name: 'Bob', extra: 1 } });
    const next = mockNext();
    validate({ body: schema })(req, mockResponse(), next);
    expect(next).toHaveBeenCalled();
    expect(req.body).toEqual({ name: 'Bob' });
  });

  it('returns 400 { success:false, message, errors } and does not call next', () => {
    const req = mockRequest({ body: { name: 'B' }, params: { id: 'x' } });
    const res = mockResponse();
    const next = mockNext();
    validate({ params: z.object({ id: z.string().uuid() }), body: schema })(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    const payload = (res.json as jest.Mock).mock.calls[0][0];
    expect(payload.success).toBe(false);
    expect(typeof payload.message).toBe('string');
    expect(payload.errors.map((e: any) => e.path)).toEqual(expect.arrayContaining(['params.id', 'body.name']));
  });

  it('can replace a getter-only req.query (Express 5)', () => {
    const req: any = {};
    Object.defineProperty(req, 'query', { get: () => ({ limit: '5', junk: '1' }), configurable: true });
    const next = mockNext();
    validate({ query: z.object({ limit: z.string().optional() }) })(req, mockResponse(), next);
    expect(next).toHaveBeenCalled();
    expect(req.query).toEqual({ limit: '5' });
  });
});
