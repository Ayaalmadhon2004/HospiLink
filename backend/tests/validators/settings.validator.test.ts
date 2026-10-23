import {
  updateProfileSchema,
  updateSecuritySettingsSchema,
  updateDisplaySettingsSchema,
  isValidTimeZone,
} from '../../src/validators/settings.validator';

describe('settings.validator', () => {
  describe('updateProfileSchema', () => {
    it('يقبل حقل واحد ويقص الفراغات', () => {
      const r = updateProfileSchema.safeParse({ name: '  Dr. Aya ' });
      expect(r.success).toBe(true);
      if (r.success) expect(r.data.name).toBe('Dr. Aya');
    });

    it('يرفض النص الفارغ أو الفراغات فقط بدل تجاهله بصمت', () => {
      expect(updateProfileSchema.safeParse({ name: '' }).success).toBe(false);
      expect(updateProfileSchema.safeParse({ department: '   ' }).success).toBe(false);
      expect(updateProfileSchema.safeParse({ shift: '' }).success).toBe(false);
    });

    it('يرفض الطلب الذي لا يحتوي أي حقل', () => {
      expect(updateProfileSchema.safeParse({}).success).toBe(false);
    });
  });

  describe('updateSecuritySettingsSchema', () => {
    it('يرفض twoFactorAuth بأي قيمة: تُدار فقط عبر /api/auth/2fa', () => {
      expect(updateSecuritySettingsSchema.safeParse({ twoFactorAuth: true }).success).toBe(false);
      expect(updateSecuritySettingsSchema.safeParse({ twoFactorAuth: false }).success).toBe(false);
    });

    it('يقبل إيقافها وباقي الإعدادات', () => {
      expect(updateSecuritySettingsSchema.safeParse({ autoLockIdleSessions: true, compactDensity: true }).success).toBe(true);
    });
  });

  describe('updateDisplaySettingsSchema timezone', () => {
    it.each(['UTC', 'Asia/Amman', 'America/New_York'])('يقبل %s', (timezone) => {
      expect(updateDisplaySettingsSchema.safeParse({ timezone }).success).toBe(true);
    });

    it.each(['Mars/Olympus', 'not a zone', 'GMT+99'])('يرفض %s', (timezone) => {
      expect(updateDisplaySettingsSchema.safeParse({ timezone }).success).toBe(false);
    });

    it('isValidTimeZone', () => {
      expect(isValidTimeZone('Europe/London')).toBe(true);
      expect(isValidTimeZone('Nope/Nope')).toBe(false);
    });
  });
});
