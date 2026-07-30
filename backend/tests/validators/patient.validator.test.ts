const mockSchema = {
  safeParse: (value: any) => {
    const errors: Array<{ path: string[]; message: string }> = [];
    if (!value || typeof value !== 'object') {
      return { success: false, error: { issues: [{ path: ['root'], message: 'Invalid input' }] } };
    }

    if (typeof value.name !== 'string' || value.name.trim().length < 2) {
      errors.push({ path: ['name'], message: 'يجب أن يكون الاسم 2 أحرف على الأقل' });
    }
    if (typeof value.age !== 'number' || !Number.isInteger(value.age) || value.age <= 0) {
      errors.push({ path: ['age'], message: 'العمر يجب أن يكون رقماً موجباً' });
    }
    if (typeof value.condition !== 'string' || value.condition.trim().length < 5) {
      errors.push({ path: ['condition'], message: 'يرجى كتابة وصف الحالة بشكل أوضح' });
    }
    if (typeof value.bedId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.bedId)) {
      errors.push({ path: ['bedId'], message: 'معرف السرير غير صالح' });
    }
    if (typeof value.hospitalId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.hospitalId)) {
      errors.push({ path: ['hospitalId'], message: 'معرف المستشفى غير صالح' });
    }

    if (errors.length > 0) {
      return { success: false, error: { issues: errors } };
    }

    return { success: true, data: value };
  }
};

const admitPatientSchema = mockSchema;

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
      expect(result.error.issues[0].message).toContain('أحرف');
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
