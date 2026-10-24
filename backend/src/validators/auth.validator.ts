// backend/src/validators/auth.validator.ts
import { z } from 'zod';

// Signup schema. `.strict()` is NOT used (extra keys are stripped instead), so a
// client sending `role` / `hospitalId` is silently ignored: public signup can
// never choose a role or a hospital id. It joins a hospital only by presenting that
// hospital's secret `hospitalCode`, resolved server-side (see register in auth.controller.ts).
export const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128, 'Password is too long'),
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100, 'Name is too long'),
  department: z.string().trim().min(1, 'Department is required').max(100),
  shift: z.string().trim().min(1, 'Shift is required').max(50),
  hospitalCode: z.string().trim().toUpperCase().min(1, 'Hospital code is required').max(32),
});

// Login only checks the input shape; password rules are not enforced here so
// existing accounts with older passwords can still sign in.
export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Invalid email address'),
  password: z.string().min(1, 'Password is required').max(128),
  rememberMe: z.boolean().optional().default(false),
});

const tokenField = z.string().min(20, 'Invalid token').max(200, 'Invalid token');
const newPasswordField = z.string().min(8, 'Password must be at least 8 characters').max(128, 'Password is too long');

export const forgotPasswordSchema = z.object({ email: z.string().trim().toLowerCase().email('Invalid email address') });
export const resendVerificationSchema = forgotPasswordSchema;
export const resetPasswordSchema = z.object({ token: tokenField, password: newPasswordField });
export const verifyEmailSchema = z.object({ token: tokenField });
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required').max(128),
  newPassword: newPasswordField,
});

const totpCode = z.string().trim().regex(/^\d{6}$/, 'Code must be 6 digits');
const recoveryCode = z.string().trim().regex(/^[a-fA-F0-9]{5}-?[a-fA-F0-9]{5}$/, 'Invalid recovery code');

// Exactly one of `code` (authenticator app) or `recoveryCode`.
const secondFactor = {
  code: totpCode.optional(),
  recoveryCode: recoveryCode.optional(),
};
const exactlyOneFactor = (v: { code?: string; recoveryCode?: string }) => Boolean(v.code) !== Boolean(v.recoveryCode);
const factorMessage = { message: 'Provide either a code or a recovery code' };

export const twoFactorLoginSchema = z
  .object({ challengeToken: z.string().min(20).max(1000), ...secondFactor })
  .refine(exactlyOneFactor, factorMessage);
export const twoFactorEnableSchema = z.object({ code: totpCode });
export const twoFactorDisableSchema = z
  .object({ password: z.string().min(1, 'Password is required').max(128), ...secondFactor })
  .refine(exactlyOneFactor, factorMessage);

// Regenerating recovery codes needs the same proof as disabling 2FA.
export const twoFactorRegenerateSchema = twoFactorDisableSchema;

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

export const formatZodError = (error: z.ZodError): string =>
  error.issues.map((i) => (i.path.length ? `${i.path.join('.')}: ${i.message}` : i.message)).join('; ');
