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
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'Not found',
    });
  });

  it('يرجع 500 ورسالة افتراضية لما ما يكون فيه status أو message', () => {
    const req = mockRequest();
    const res = mockResponse();
    const next = mockNext();

    const err = { stack: 'stack-trace' };

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'حدث خطأ غير متوقع في السيرفر',
    });
  });
});
