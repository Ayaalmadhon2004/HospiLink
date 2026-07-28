import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prismaMock } from '../mocks/prisma';
import { mockRequest, mockResponse } from '../mocks/http';
import {
  register,
  login,
  logout,
  getMe,
  updatePassword,
} from '../../src/controllers/auth.controller';
import { JWT_SECRET } from '../../src/config/jwt';

describe('auth.controller', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('register', () => {
    it('يرفض التسجيل لو الإيميل مستخدم من قبل', async () => {
      const req = mockRequest({
        body: { email: 'exists@hospilink.com', password: '12345678', name: 'A' },
      });
      const res = mockResponse();

      prismaMock.user.findUnique.mockResolvedValue({ id: 'u1' } as any);

      await register(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, message: expect.stringContaining('already exists') })
      );
      expect(prismaMock.user.create).not.toHaveBeenCalled();
    });

    it('ينشئ مستخدم جديد، بيهاش الباسورد، وبيرجع توكن + كوكي', async () => {
      const req = mockRequest({
        body: {
          email: 'new@hospilink.com',
          password: 'secret123',
          name: 'Dr. Sara',
          department: 'ER',
          shift: 'DAY',
          hospitalId: 'hosp-1',
        },
      });
      const res = mockResponse();

      prismaMock.user.findUnique.mockResolvedValue(null);
      prismaMock.user.create.mockResolvedValue({
        id: 'new-user',
        email: 'new@hospilink.com',
        name: 'Dr. Sara',
        role: 'STAFF',
        department: 'ER',
        shift: 'DAY',
        status: 'OFF_DUTY',
        hospitalId: 'hosp-1',
        createdAt: new Date(),
      } as any);

      await register(req, res);

      // الباسورد لازم يترمّز، مش يترسل كما هو
      const createCallArg = prismaMock.user.create.mock.calls[0][0] as any;
      expect(createCallArg.data.password).not.toBe('secret123');
      expect(await bcrypt.compare('secret123', createCallArg.data.password)).toBe(true);
      expect(createCallArg.data.role).toBe('STAFF'); // القيمة الافتراضية

      expect(res.cookie).toHaveBeenCalledWith(
        'token',
        expect.any(String),
        expect.objectContaining({ httpOnly: true })
      );
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, token: expect.any(String) })
      );
    });

    it('يرجع 500 لو صار خطأ غير متوقع', async () => {
      const req = mockRequest({ body: { email: 'x@x.com', password: 'p' } });
      const res = mockResponse();

      prismaMock.user.findUnique.mockRejectedValue(new Error('DB down'));

      await register(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('login', () => {
    it('يرفض الطلب لو الإيميل أو الباسورد ناقصين', async () => {
      const req = mockRequest({ body: { email: 'only-email@x.com' } });
      const res = mockResponse();

      await login(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
    });

    it('يرفض لو المستخدم مش موجود', async () => {
      const req = mockRequest({ body: { email: 'ghost@x.com', password: 'p' } });
      const res = mockResponse();

      prismaMock.user.findUnique.mockResolvedValue(null);

      await login(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Invalid credentials' })
      );
    });

    it('يرفض لو الباسورد غلط', async () => {
      const hashed = await bcrypt.hash('correct-password', 4);
      const req = mockRequest({ body: { email: 'a@a.com', password: 'wrong-password' } });
      const res = mockResponse();

      prismaMock.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'a@a.com',
        password: hashed,
        role: 'DOCTOR',
        hospital: null,
      } as any);

      await login(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('يسجل الدخول بنجاح ويرجع توكن + بيانات المستخدم بدون الباسورد', async () => {
      const hashed = await bcrypt.hash('correct-password', 4);
      const req = mockRequest({ body: { email: 'a@a.com', password: 'correct-password' } });
      const res = mockResponse();

      prismaMock.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'a@a.com',
        password: hashed,
        role: 'DOCTOR',
        name: 'Dr. A',
        hospital: { id: 'h1', name: 'HospiLink General', location: 'Nablus' },
      } as any);

      await login(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const jsonArg = (res.json as jest.Mock).mock.calls[0][0];
      expect(jsonArg.success).toBe(true);
      expect(jsonArg.user.password).toBeUndefined();
      expect(jsonArg.user.email).toBe('a@a.com');

      // تأكد إنه التوكن فعلاً صالح ويحتوي بيانات المستخدم الصح
      const decoded = jwt.verify(jsonArg.token, JWT_SECRET) as any;
      expect(decoded.userId).toBe('u1');
      expect(decoded.role).toBe('DOCTOR');
    });
  });

  describe('logout', () => {
    it('يمسح الكوكي ويرجع رسالة نجاح', async () => {
      const req = mockRequest();
      const res = mockResponse();

      await logout(req, res);

      expect(res.clearCookie).toHaveBeenCalledWith('token', expect.any(Object));
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('getMe', () => {
    it('يرجع 401 لو ما في مستخدم مصادق عليه بالطلب', async () => {
      const req = mockRequest({ user: undefined });
      const res = mockResponse();

      await getMe(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('يرجع 404 لو المستخدم محذوف من الداتابيز', async () => {
      const req = mockRequest({ user: { id: 'gone', email: 'a@a.com', role: 'DOCTOR' } });
      const res = mockResponse();

      prismaMock.user.findUnique.mockResolvedValue(null);

      await getMe(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('يرجع بيانات المستخدم الحالي بنجاح', async () => {
      const req = mockRequest({ user: { id: 'u1', email: 'a@a.com', role: 'DOCTOR' } });
      const res = mockResponse();

      prismaMock.user.findUnique.mockResolvedValue({ id: 'u1', name: 'Dr. A' } as any);

      await getMe(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, user: expect.objectContaining({ id: 'u1' }) })
      );
    });
  });

  describe('updatePassword', () => {
    it('يرفض لو الباسورد الحالي غلط', async () => {
      const hashed = await bcrypt.hash('real-password', 4);
      const req = mockRequest({
        user: { id: 'u1', email: 'a@a.com', role: 'DOCTOR' },
        body: { currentPassword: 'wrong', newPassword: 'newpass123' },
      });
      const res = mockResponse();

      prismaMock.user.findUnique.mockResolvedValue({ id: 'u1', password: hashed } as any);

      await updatePassword(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(prismaMock.user.update).not.toHaveBeenCalled();
    });

    it('يحدث الباسورد بنجاح لو الباسورد الحالي صحيح', async () => {
      const hashed = await bcrypt.hash('real-password', 4);
      const req = mockRequest({
        user: { id: 'u1', email: 'a@a.com', role: 'DOCTOR' },
        body: { currentPassword: 'real-password', newPassword: 'newpass123' },
      });
      const res = mockResponse();

      prismaMock.user.findUnique.mockResolvedValue({ id: 'u1', password: hashed } as any);
      prismaMock.user.update.mockResolvedValue({} as any);

      await updatePassword(req, res);

      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { password: expect.any(String) },
      });
      const newHashed = (prismaMock.user.update.mock.calls[0][0] as any).data.password;
      expect(await bcrypt.compare('newpass123', newHashed)).toBe(true);
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });
});