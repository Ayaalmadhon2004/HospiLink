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
    const validBody = {
      email: 'new@hospilink.com',
      password: 'secret123',
      name: 'Dr. Sara',
      department: 'ER',
      shift: 'DAY',
    };

    it('يرفض بيانات غير صالحة بـ 400 ولا يلمس الداتابيز', async () => {
      const req = mockRequest({ body: { email: 'bad', password: 'short', name: 'A' } });
      const res = mockResponse();

      await register(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(prismaMock.user.create).not.toHaveBeenCalled();
      expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
    });

    it('يتجاهل role و hospitalId القادمة من الطلب (منع ADMIN self-signup)', async () => {
      const req = mockRequest({
        body: { ...validBody, role: 'ADMIN', hospitalId: 'attacker-hospital' },
      });
      const res = mockResponse();

      prismaMock.user.findUnique.mockResolvedValue(null);
      prismaMock.hospital.findFirst.mockResolvedValue({ id: 'server-hosp' } as any);
      prismaMock.user.create.mockResolvedValue({
        id: 'u', email: validBody.email, role: 'NURSE',
      } as any);

      await register(req, res);

      const data = (prismaMock.user.create.mock.calls[0][0] as any).data;
      expect(data.role).toBe('NURSE');
      expect(data.accountStatus).toBe('PENDING');
      expect(data.hospitalId).toBe('server-hosp');
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('يرجع 500 عام بدون تسريب رسالة الخطأ الداخلية', async () => {
      const req = mockRequest({ body: validBody });
      const res = mockResponse();

      prismaMock.hospital.findFirst.mockResolvedValue({ id: 'h' } as any);
      prismaMock.user.findUnique.mockRejectedValue(new Error('secret db detail'));

      await register(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(JSON.stringify((res.json as jest.Mock).mock.calls[0][0])).not.toContain('secret db detail');
    });

    it('يرفض التسجيل لو الإيميل مستخدم من قبل', async () => {
      const req = mockRequest({
        body: { ...validBody, email: 'exists@hospilink.com' },
      });
      const res = mockResponse();

      prismaMock.hospital.findFirst.mockResolvedValue({ id: 'h' } as any);
      prismaMock.user.findUnique.mockResolvedValue({ id: 'u1' } as any);

      await register(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, message: expect.stringContaining('already exists') })
      );
      expect(prismaMock.user.create).not.toHaveBeenCalled();
    });

    it('ينشئ مستخدم PENDING، بيهاش الباسورد، وما بيرجع توكن ولا كوكي', async () => {
      const req = mockRequest({
        body: validBody,
      });
      const res = mockResponse();

      prismaMock.hospital.findFirst.mockResolvedValue({ id: 'hosp-1' } as any);
      prismaMock.user.findUnique.mockResolvedValue(null);
      prismaMock.user.create.mockResolvedValue({
        id: 'new-user',
        email: 'new@hospilink.com',
        name: 'Dr. Sara',
        role: 'NURSE',
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
      expect(createCallArg.data.role).toBe('NURSE'); // أقل دور
      expect(createCallArg.data.accountStatus).toBe('PENDING');

      // pending accounts are not signed in
      expect(res.cookie).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
      const body = (res.json as jest.Mock).mock.calls[0][0];
      expect(body.success).toBe(true);
      expect(body.token).toBeUndefined();
      expect(body.message).toMatch(/pending admin approval/i);
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

    it.each([
      ['PENDING', 'Account pending admin approval', 'ACCOUNT_PENDING'],
      ['DISABLED', 'Account is disabled', 'ACCOUNT_DISABLED'],
    ])('يرفض حساب %s بـ 403 بعد التحقق من الباسورد ولا يعطي توكن', async (accountStatus, message, code) => {
      const hashed = await bcrypt.hash('correct-password', 4);
      const req = mockRequest({ body: { email: 'a@a.com', password: 'correct-password' } });
      const res = mockResponse();
      prismaMock.user.findUnique.mockResolvedValue({
        id: 'u1', email: 'a@a.com', password: hashed, role: 'NURSE', accountStatus, hospital: null,
      } as any);

      await login(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ success: false, message, code });
      expect(res.cookie).not.toHaveBeenCalled();
    });

    it('PENDING مع باسورد غلط يرجع 401 (ما يكشف حالة الحساب)', async () => {
      const hashed = await bcrypt.hash('correct-password', 4);
      const req = mockRequest({ body: { email: 'a@a.com', password: 'wrong-password' } });
      const res = mockResponse();
      prismaMock.user.findUnique.mockResolvedValue({
        id: 'u1', email: 'a@a.com', password: hashed, role: 'NURSE', accountStatus: 'PENDING', hospital: null,
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
        accountStatus: 'ACTIVE',
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
      const req = mockRequest({ user: { id: 'gone', email: 'a@a.com', role: 'DOCTOR', hospitalId: 'hosp-1' } });
      const res = mockResponse();

      prismaMock.user.findUnique.mockResolvedValue(null);

      await getMe(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('يرجع بيانات المستخدم الحالي بنجاح', async () => {
      const req = mockRequest({ user: { id: 'u1', email: 'a@a.com', role: 'DOCTOR', hospitalId: 'hosp-1' } });
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
        user: { id: 'u1', email: 'a@a.com', role: 'DOCTOR', hospitalId: 'hosp-1' },
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
        user: { id: 'u1', email: 'a@a.com', role: 'DOCTOR', hospitalId: 'hosp-1' },
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
