import { registerSchema, loginSchema } from '../../src/validators/auth.validator';

const valid = { email: 'A@B.com', password: 'password1', name: 'Sara', department: 'ER', shift: 'DAY', hospitalCode: 'north-1' };

describe('registerSchema', () => {
  it('accepts valid input and normalizes email', () => {
    const r = registerSchema.safeParse(valid);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.email).toBe('a@b.com');
      expect(r.data.hospitalCode).toBe('NORTH-1');
    }
  });

  it('strips role and hospitalId', () => {
    const r = registerSchema.safeParse({ ...valid, role: 'ADMIN', hospitalId: 'x' });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data).not.toHaveProperty('role');
      expect(r.data).not.toHaveProperty('hospitalId');
    }
  });

  it.each([
    ['bad email', { email: 'nope' }],
    ['short password', { password: '1234567' }],
    ['short name', { name: 'A' }],
    ['missing department', { department: undefined }],
    ['missing shift', { shift: undefined }],
    ['missing hospitalCode', { hospitalCode: undefined }],
    ['blank hospitalCode', { hospitalCode: '  ' }],
  ])('rejects %s', (_l, patch) => {
    expect(registerSchema.safeParse({ ...valid, ...patch }).success).toBe(false);
  });
});

describe('loginSchema', () => {
  it('accepts valid shape (any password length)', () => {
    expect(loginSchema.safeParse({ email: 'a@b.com', password: 'x' }).success).toBe(true);
  });
  it('rejects missing/invalid fields and non-strings', () => {
    expect(loginSchema.safeParse({ email: 'a@b.com' }).success).toBe(false);
    expect(loginSchema.safeParse({ email: 'bad', password: 'x' }).success).toBe(false);
    expect(loginSchema.safeParse({ email: { $ne: '' }, password: 'x' }).success).toBe(false);
  });
});
