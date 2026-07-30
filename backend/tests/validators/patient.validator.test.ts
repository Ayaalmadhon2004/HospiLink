import { admitPatientSchema } from '../../src/validators/patient.validator';

describe('admitPatientSchema', () => {
  const validData = {
    name: 'Ahmad Khaled',
    age: 34,
    condition: 'Stable but under observation',
    bedId: '123e4567-e89b-12d3-a456-426614174000',
    hospitalId: '123e4567-e89b-12d3-a456-426614174001',
  };

  it('يقبل بيانات صحيحة كاملة', () => {
    const result = admitPatientSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('يرفض اسم أقل من حرفين', () => {
    const result = admitPatientSchema.safeParse({ ...validData, name: 'A' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('حرفين');
    }
  });

  it('يرفض عمر سالب أو صفر', () => {
    const negative = admitPatientSchema.safeParse({ ...validData, age: -5 });
    const zero = admitPatientSchema.safeParse({ ...validData, age: 0 });
    expect(negative.success).toBe(false);
    expect(zero.success).toBe(false);
  });

  it('يرفض عمر عشري (مش رقم صحيح)', () => {
    const result = admitPatientSchema.safeParse({ ...validData, age: 34.5 });
    expect(result.success).toBe(false);
  });

  it('يرفض وصف حالة قصير جداً (أقل من 5 أحرف)', () => {
    const result = admitPatientSchema.safeParse({ ...validData, condition: 'ok' });
    expect(result.success).toBe(false);
  });

  it('يرفض bedId لو مش UUID صالح', () => {
    const result = admitPatientSchema.safeParse({ ...validData, bedId: 'not-a-uuid' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes('bedId'))).toBe(true);
    }
  });

  it('يرفض hospitalId لو مش UUID صالح', () => {
    const result = admitPatientSchema.safeParse({ ...validData, hospitalId: 'nope' });
    expect(result.success).toBe(false);
  });

  it('يرفض لو في حقول ناقصة بالكامل', () => {
    const result = admitPatientSchema.safeParse({});
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.length).toBeGreaterThanOrEqual(5);
    }
  });
});
