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

import {
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyEmailSchema,
  changePasswordSchema,
} from '../../src/validators/auth.validator';

describe('recovery schemas', () => {
  const token = 'a'.repeat(32);

  it('forgotPassword lowercases and validates the email', () => {
    expect(forgotPasswordSchema.parse({ email: ' A@B.com ' }).email).toBe('a@b.com');
    expect(forgotPasswordSchema.safeParse({ email: 'x' }).success).toBe(false);
  });

  it('resetPassword needs a token and an 8+ char password', () => {
    expect(resetPasswordSchema.safeParse({ token, password: 'long-enough' }).success).toBe(true);
    expect(resetPasswordSchema.safeParse({ token, password: 'short' }).success).toBe(false);
    expect(resetPasswordSchema.safeParse({ token: 'x', password: 'long-enough' }).success).toBe(false);
  });

  it('verifyEmail needs a token', () => {
    expect(verifyEmailSchema.safeParse({ token }).success).toBe(true);
    expect(verifyEmailSchema.safeParse({}).success).toBe(false);
  });

  it('changePassword enforces the new password length', () => {
    expect(changePasswordSchema.safeParse({ currentPassword: 'old', newPassword: 'long-enough' }).success).toBe(true);
    expect(changePasswordSchema.safeParse({ currentPassword: 'old', newPassword: 'short' }).success).toBe(false);
  });
});
