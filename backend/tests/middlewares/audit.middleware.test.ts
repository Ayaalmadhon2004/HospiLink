import { prismaMock } from '../mocks/prisma';
import { mockRequest, mockResponse, mockNext } from '../mocks/http';
import { logActivity } from '../../src/middlewares/audit.middleware';

describe('audit.middleware - logActivity', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('يسجل نشاط بالـ audit log لما يكون في مستخدم مصادق عليه', async () => {
    const req = mockRequest({
      user: { id: 'user-1', email: 'a@a.com', role: 'DOCTOR' },
      params: { id: 'patient-123' },
      originalUrl: '/api/patients/patient-123',
    } as any);
    const res = mockResponse();
    const next = mockNext();

    prismaMock.auditLog.create.mockResolvedValue({} as any);

    await logActivity('UPDATE_PATIENT')(req, res, next);

    expect(prismaMock.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'UPDATE_PATIENT',
        userId: 'user-1',
        entityId: 'patient-123',
      }),
    });
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('يفضل ياخد entityId من body.patientId لو موجود قبل params.id', async () => {
    const req = mockRequest({
      user: { id: 'user-1', email: 'a@a.com', role: 'DOCTOR' },
      body: { patientId: 'patient-from-body' },
      params: { id: 'patient-from-params' },
      originalUrl: '/api/patients',
    } as any);
    const res = mockResponse();
    const next = mockNext();

    prismaMock.auditLog.create.mockResolvedValue({} as any);

    await logActivity('CREATE_PATIENT')(req, res, next);

    expect(prismaMock.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ entityId: 'patient-from-body' }),
    });
  });

  it('ما بيسجل شي وبينده next لو ما في مستخدم بالطلب', async () => {
    const req = mockRequest({ user: undefined });
    const res = mockResponse();
    const next = mockNext();

    await logActivity('SOME_ACTION')(req, res, next);

    expect(prismaMock.auditLog.create).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('ما بيوقف الطلب حتى لو فشل تسجيل الـ audit log', async () => {
    const req = mockRequest({
      user: { id: 'user-1', email: 'a@a.com', role: 'DOCTOR' },
      params: {},
      originalUrl: '/api/patients',
    } as any);
    const res = mockResponse();
    const next = mockNext();

    prismaMock.auditLog.create.mockRejectedValue(new Error('DB is down'));

    await logActivity('ACTION')(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });
});

describe('audit.middleware - logActivity on read requests', () => {
  it('يسجل VIEW_PATIENT حتى لو req.body undefined (طلب GET)', async () => {
    const req = mockRequest({
      user: { id: 'user-1', email: 'a@a.com', role: 'NURSE' },
      params: { id: 'patient-9' },
      originalUrl: '/api/patients/patient-9',
    } as any);
    (req as any).body = undefined;

    prismaMock.auditLog.create.mockResolvedValue({} as any);
    const next = mockNext();

    await logActivity('VIEW_PATIENT')(req, mockResponse(), next);

    expect(prismaMock.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: 'VIEW_PATIENT', entityId: 'patient-9' }),
    });
    expect(next).toHaveBeenCalledTimes(1);
  });
});
