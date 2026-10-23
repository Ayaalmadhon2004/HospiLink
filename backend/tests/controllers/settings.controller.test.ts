import { prismaMock } from '../mocks/prisma';
import { mockRequest, mockResponse } from '../mocks/http';
import {
  getUserSettings,
  updateProfile,
  updateNotifications,
  updateSecurity,
  updateDisplay,
} from '../../src/controllers/settings.controller';

describe('settings.controller', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  const authedReq = (overrides: any = {}) =>
    mockRequest({ user: { id: 'u1', email: 'a@a.com', role: 'ADMIN', hospitalId: 'hosp-1' }, ...overrides });

  describe('getUserSettings', () => {
    it('يرفض بـ 401 لو ما في مستخدم', async () => {
      const req = mockRequest({ user: undefined });
      const res = mockResponse();

      await getUserSettings(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('ينشئ إعدادات افتراضية لو المستخدم ما عنده إعدادات محفوظة أصلاً', async () => {
      prismaMock.userSettings.findUnique.mockResolvedValue(null);
      prismaMock.userSettings.create.mockResolvedValue({
        userId: 'u1',
        criticalVitalsAlerts: true,
        incidentEscalations: true,
        shiftReminders: false,
        dispatchAlerts: true,
        appointmentReminders: true,
        twoFactorAuth: false,
        autoLockIdleSessions: true,
        compactDensity: false,
        theme: 'light',
        language: 'en',
        timezone: 'UTC',
      } as any);
      prismaMock.user.findUnique.mockResolvedValue({ id: 'u1', name: 'Dr. A' } as any);

      const req = authedReq();
      const res = mockResponse();

      await getUserSettings(req, res);

      expect(prismaMock.userSettings.create).toHaveBeenCalledWith({ data: { userId: 'u1' } });
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('يرجع الإعدادات الموجودة مقسّمة لأقسام (notifications/security/display)', async () => {
      prismaMock.userSettings.findUnique.mockResolvedValue({
        userId: 'u1',
        criticalVitalsAlerts: false,
        incidentEscalations: true,
        shiftReminders: true,
        dispatchAlerts: true,
        appointmentReminders: false,
        twoFactorAuth: true,
        autoLockIdleSessions: false,
        compactDensity: true,
        theme: 'dark',
        language: 'ar',
        timezone: 'Asia/Hebron',
      } as any);
      prismaMock.user.findUnique.mockResolvedValue({ id: 'u1', twoFactorEnabledAt: new Date() } as any);

      const req = authedReq();
      const res = mockResponse();

      await getUserSettings(req, res);

      const jsonArg = (res.json as jest.Mock).mock.calls[0][0];
      expect(jsonArg.data.notifications.criticalVitalsAlerts).toBe(false);
      // 2FA state comes from the user row, not from UserSettings (which says false here would be ignored).
      expect(jsonArg.data.security.twoFactorAuth).toBe(true);
      expect(jsonArg.data.profile).not.toHaveProperty('twoFactorEnabledAt');
      expect(jsonArg.data.display.theme).toBe('dark');
      expect(prismaMock.userSettings.create).not.toHaveBeenCalled();
    });
  });

  describe('getUserSettings hospital code', () => {
    const settingsRow = { userId: 'u1', theme: 'light', language: 'en', timezone: 'UTC' };

    it('يطلب code للـ ADMIN فقط ومن مستشفى المستخدم نفسه', async () => {
      prismaMock.userSettings.findUnique.mockResolvedValue(settingsRow as any);
      prismaMock.user.findUnique.mockResolvedValue({ id: 'u1' } as any);
      prismaMock.hospital.findUnique.mockResolvedValue({ name: 'H', code: 'NORTH-1' } as any);
      const res = mockResponse();

      await getUserSettings(authedReq(), res);

      expect(prismaMock.hospital.findUnique).toHaveBeenCalledWith({
        where: { id: 'hosp-1' },
        select: { name: true, code: true },
      });
      expect((res.json as jest.Mock).mock.calls[0][0].data.hospital).toEqual({ name: 'H', code: 'NORTH-1' });
    });

    it('ما يطلب code لغير الـ ADMIN', async () => {
      prismaMock.userSettings.findUnique.mockResolvedValue(settingsRow as any);
      prismaMock.user.findUnique.mockResolvedValue({ id: 'u1' } as any);
      prismaMock.hospital.findUnique.mockResolvedValue({ name: 'H' } as any);
      const req = mockRequest({ user: { id: 'u1', email: 'a@a.com', role: 'NURSE', hospitalId: 'hosp-1' } });

      await getUserSettings(req, mockResponse());

      expect(prismaMock.hospital.findUnique).toHaveBeenCalledWith({
        where: { id: 'hosp-1' },
        select: { name: true, code: false },
      });
    });
  });

  describe('updateProfile', () => {
    it('يحدث الحقول المرسلة بس بدون ما يمسح الباقي', async () => {
      prismaMock.user.update.mockResolvedValue({ id: 'u1', name: 'New Name' } as any);

      const req = authedReq({ body: { name: 'New Name' } });
      const res = mockResponse();

      await updateProfile(req, res);

      expect(prismaMock.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { name: 'New Name', department: undefined, shift: undefined },
        })
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('يمرّر القيم كما هي بدون تحويل الفارغ إلى undefined (التحقق في الـ validator)', async () => {
      prismaMock.user.update.mockResolvedValue({ id: 'u1' } as any);

      await updateProfile(authedReq({ body: { name: 'A', department: 'ICU', shift: 'Night' } }), mockResponse());

      expect(prismaMock.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { name: 'A', department: 'ICU', shift: 'Night' } })
      );
    });

    it('401 بدون مستخدم', async () => {
      const res = mockResponse();
      await updateProfile(mockRequest({ user: undefined }), res);
      expect(res.status).toHaveBeenCalledWith(401);
    });
  });

  describe('updateNotifications', () => {
    it('يستخدم upsert حتى ينشئ الإعدادات لو مش موجودة', async () => {
      prismaMock.userSettings.upsert.mockResolvedValue({} as any);

      const req = authedReq({ body: { criticalVitalsAlerts: false } });
      const res = mockResponse();

      await updateNotifications(req, res);

      expect(prismaMock.userSettings.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'u1' },
          create: expect.objectContaining({ userId: 'u1', criticalVitalsAlerts: false }),
        })
      );
    });
  });

  describe('updateSecurity', () => {
    it('يحدث إعدادات الأمان', async () => {
      prismaMock.userSettings.upsert.mockResolvedValue({} as any);

      const req = authedReq({ body: { autoLockIdleSessions: true, compactDensity: true } });
      const res = mockResponse();

      await updateSecurity(req, res);

      expect(prismaMock.userSettings.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ update: { autoLockIdleSessions: true, compactDensity: true } })
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('لا يحفظ twoFactorAuth أبداً حتى لو وصل للـ controller (الميزة غير مفعّلة)', async () => {
      prismaMock.userSettings.upsert.mockResolvedValue({} as any);

      const req = authedReq({ body: { twoFactorAuth: true } });
      const res = mockResponse();

      await updateSecurity(req, res);

      const arg = prismaMock.userSettings.upsert.mock.calls[0][0] as any;
      expect(arg.update).not.toHaveProperty('twoFactorAuth');
      expect(arg.create).not.toHaveProperty('twoFactorAuth');
    });

    it('401 بدون مستخدم', async () => {
      const res = mockResponse();
      await updateSecurity(mockRequest({ user: undefined }), res);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('500 عند فشل قاعدة البيانات بدون تسريب الرسالة', async () => {
      prismaMock.userSettings.upsert.mockRejectedValue(new Error('db secret'));
      const res = mockResponse();
      await updateSecurity(authedReq({ body: { compactDensity: true } }), res);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(JSON.stringify((res.json as jest.Mock).mock.calls[0][0])).not.toContain('db secret');
    });
  });

  describe('updateDisplay', () => {
    it('يحدث إعدادات العرض (theme/language/timezone)', async () => {
      prismaMock.userSettings.upsert.mockResolvedValue({} as any);

      const req = authedReq({ body: { theme: 'dark', language: 'ar' } });
      const res = mockResponse();

      await updateDisplay(req, res);

      expect(prismaMock.userSettings.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: { theme: 'dark', language: 'ar', timezone: undefined },
        })
      );
    });
  });
});
