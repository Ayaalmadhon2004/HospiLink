import jwt from 'jsonwebtoken';
import { prismaMock } from '../mocks/prisma';
import { mockRequest, mockResponse, mockNext } from '../mocks/http';
import { protect, authorize } from '../../src/middlewares/auth.middleware';
import { JWT_SECRET } from '../../src/config/jwt';

describe('auth.middleware', () => {
  describe('protect', () => {
    it('يرفض الطلب لما ما في توكن نهائياً', async () => {
      const req = mockRequest();
      const res = mockResponse();
      const next = mockNext();

      await protect(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, error: expect.objectContaining({ code: 'UNAUTHORIZED', message: expect.stringContaining('Unauthorized') }) })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('ياخد التوكن من الـ Authorization header (Bearer) ويكمل لو صحيح', async () => {
      const token = jwt.sign({ userId: 'user-1' }, JWT_SECRET);
      const req = mockRequest({
        headers: { authorization: `Bearer ${token}` } as any,
      });
      const res = mockResponse();
      const next = mockNext();

      prismaMock.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'doc@hospilink.com',
        role: 'DOCTOR',
        hospitalId: 'hosp-1',
        accountStatus: 'ACTIVE',
      } as any);

      await protect(req, res, next);

      expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        select: { id: true, email: true, role: true, hospitalId: true, accountStatus: true, passwordChangedAt: true },
      });
      expect(req.user).toEqual({
        id: 'user-1',
        email: 'doc@hospilink.com',
        role: 'DOCTOR',
        hospitalId: 'hosp-1',
      });
      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });

    it('يرفض توكن صدر قبل آخر تغيير للباسورد (revocation)', async () => {
      const token = jwt.sign({ userId: 'user-1', iat: Math.floor(Date.now() / 1000) - 3600 }, JWT_SECRET);
      const req = mockRequest({ headers: { authorization: `Bearer ${token}` } as any });
      const res = mockResponse();
      const next = mockNext();
      prismaMock.user.findUnique.mockResolvedValue({
        id: 'user-1', email: 'a@a.com', role: 'DOCTOR', hospitalId: 'hosp-1', accountStatus: 'ACTIVE',
        passwordChangedAt: new Date(),
      } as any);

      await protect(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it('يرفض توكن تم إلغاؤه بالـ logout (jti موجود بجدول RevokedToken)', async () => {
      const token = jwt.sign({ userId: 'user-1' }, JWT_SECRET, { jwtid: 'jti-x' });
      const req = mockRequest({ headers: { authorization: `Bearer ${token}` } as any });
      const res = mockResponse();
      const next = mockNext();
      prismaMock.revokedToken.findUnique.mockResolvedValue({ jti: 'jti-x' } as any);

      await protect(req, res, next);

      expect(prismaMock.revokedToken.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { jti: 'jti-x' } }));
      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it('يقبل توكن بـ jti غير ملغى، وتوكن قديم بلا jti بدون أي استعلام', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: 'user-1', email: 'a@a.com', role: 'DOCTOR', hospitalId: 'hosp-1', accountStatus: 'ACTIVE', passwordChangedAt: null,
      } as any);
      prismaMock.revokedToken.findUnique.mockResolvedValue(null);
      const withJti = jwt.sign({ userId: 'user-1' }, JWT_SECRET, { jwtid: 'jti-ok' });
      const next1 = mockNext();
      await protect(mockRequest({ headers: { authorization: `Bearer ${withJti}` } as any }), mockResponse(), next1);
      expect(next1).toHaveBeenCalledTimes(1);

      prismaMock.revokedToken.findUnique.mockClear();
      const legacy = jwt.sign({ userId: 'user-1' }, JWT_SECRET);
      const next2 = mockNext();
      await protect(mockRequest({ headers: { authorization: `Bearer ${legacy}` } as any }), mockResponse(), next2);
      expect(next2).toHaveBeenCalledTimes(1);
      expect(prismaMock.revokedToken.findUnique).not.toHaveBeenCalled();
    });

    it('يقبل توكن صدر بعد آخر تغيير للباسورد', async () => {
      const token = jwt.sign({ userId: 'user-1' }, JWT_SECRET);
      const req = mockRequest({ headers: { authorization: `Bearer ${token}` } as any });
      const res = mockResponse();
      const next = mockNext();
      prismaMock.user.findUnique.mockResolvedValue({
        id: 'user-1', email: 'a@a.com', role: 'DOCTOR', hospitalId: 'hosp-1', accountStatus: 'ACTIVE',
        passwordChangedAt: new Date(Date.now() - 3600_000),
      } as any);

      await protect(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
    });

    it('ياخد التوكن من الكوكيز لو ما في Authorization header', async () => {
      const token = jwt.sign({ userId: 'user-2' }, JWT_SECRET);
      const req = mockRequest({ cookies: { token } as any });
      const res = mockResponse();
      const next = mockNext();

      prismaMock.user.findUnique.mockResolvedValue({
        id: 'user-2',
        email: 'nurse@hospilink.com',
        role: 'NURSE',
        hospitalId: 'hosp-1',
        accountStatus: 'ACTIVE',
      } as any);

      await protect(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(req.user?.id).toBe('user-2');
    });

    it('يرفض حساب PENDING بـ 403 ولا يكمل للـ controller', async () => {
      const token = jwt.sign({ userId: 'user-3' }, JWT_SECRET);
      const req = mockRequest({ headers: { authorization: `Bearer ${token}` } as any });
      const res = mockResponse();
      const next = mockNext();
      prismaMock.user.findUnique.mockResolvedValue({
        id: 'user-3', email: 'p@x.com', role: 'NURSE', hospitalId: 'hosp-1', accountStatus: 'PENDING',
      } as any);

      await protect(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, error: { code: 'ACCOUNT_PENDING', message: 'Account pending admin approval' }, code: 'ACCOUNT_PENDING' })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('يرفض حساب DISABLED بـ 403', async () => {
      const token = jwt.sign({ userId: 'user-4' }, JWT_SECRET);
      const req = mockRequest({ headers: { authorization: `Bearer ${token}` } as any });
      const res = mockResponse();
      const next = mockNext();
      prismaMock.user.findUnique.mockResolvedValue({
        id: 'user-4', email: 'd@x.com', role: 'DOCTOR', hospitalId: 'hosp-1', accountStatus: 'DISABLED',
      } as any);

      await protect(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'ACCOUNT_DISABLED' }));
      expect(next).not.toHaveBeenCalled();
    });

    it('يرفض التوكن غير الصالح أو المنتهي', async () => {
      const req = mockRequest({ headers: { authorization: 'Bearer not-a-real-token' } as any });
      const res = mockResponse();
      const next = mockNext();

      await protect(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' } })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('يرفض لو التوكن صحيح بس المستخدم مش موجود بالداتابيز', async () => {
      const token = jwt.sign({ userId: 'ghost-user' }, JWT_SECRET);
      const req = mockRequest({ headers: { authorization: `Bearer ${token}` } as any });
      const res = mockResponse();
      const next = mockNext();

      prismaMock.user.findUnique.mockResolvedValue(null);

      await protect(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: { code: 'UNAUTHORIZED', message: 'User not found' } })
      );
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('authorize', () => {
    it('يسمح بالمرور لو الرول موجود ضمن الأدوار المسموحة', () => {
      const req = mockRequest({ user: { id: '1', email: 'a@a.com', role: 'ADMIN', hospitalId: 'hosp-1' } });
      const res = mockResponse();
      const next = mockNext();

      authorize('ADMIN', 'DOCTOR')(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });

    it('يرفض بـ 403 لو الرول مش من ضمن المسموح فيهم', () => {
      const req = mockRequest({ user: { id: '1', email: 'a@a.com', role: 'NURSE', hospitalId: 'hosp-1' } });
      const res = mockResponse();
      const next = mockNext();

      authorize('ADMIN')(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.objectContaining({ code: 'FORBIDDEN', details: { required: ['ADMIN'], current: 'NURSE' } }) })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('يرفض بـ 403 لو ما في مستخدم مصادق عليه أصلاً', () => {
      const req = mockRequest({ user: undefined });
      const res = mockResponse();
      const next = mockNext();

      authorize('ADMIN')(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.objectContaining({ code: 'FORBIDDEN', details: { required: ['ADMIN'], current: 'none' } }) })
      );
      expect(next).not.toHaveBeenCalled();
    });
  });
});
