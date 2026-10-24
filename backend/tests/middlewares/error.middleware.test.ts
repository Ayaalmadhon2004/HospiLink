import { errorHandler } from '../../src/middlewares/error.middleware';
import { mockRequest, mockResponse, mockNext } from '../mocks/http';

describe('error.middleware', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('يرجع status و message المخصصين لما يكونوا موجودين بالخطأ', () => {
    const req = mockRequest();
    const res = mockResponse();
    const next = mockNext();

    const err = { status: 404, message: 'Not found', stack: 'stack-trace' };

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      message: 'Not found',
      error: { code: 'NOT_FOUND', message: 'Not found' },
    }));
  });

  it('يرجع 500 ورسالة افتراضية لما ما يكون فيه status أو message', () => {
    const req = mockRequest();
    const res = mockResponse();
    const next = mockNext();

    const err = { stack: 'stack-trace' };

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Unexpected server error' },
    }));
  });

  it('لا يكشف رسالة الخطأ الداخلية لما يكون status >= 500 أو مفقود', () => {
    const res = mockResponse();

    errorHandler({ status: 503, message: 'secret db detail' }, mockRequest(), res, mockNext());
    errorHandler(new Error('secret db detail'), mockRequest(), res, mockNext());

    expect(res.status).toHaveBeenNthCalledWith(1, 503);
    expect(res.status).toHaveBeenNthCalledWith(2, 500);
    (res.json as jest.Mock).mock.calls.forEach(([body]) => {
      expect(body.error).toEqual({ code: 'INTERNAL_ERROR', message: 'Unexpected server error' });
      expect(JSON.stringify(body)).not.toContain('secret db detail');
    });
  });
});
