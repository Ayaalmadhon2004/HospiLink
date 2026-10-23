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
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

export const formatZodError = (error: z.ZodError): string =>
  error.issues.map((i) => (i.path.length ? `${i.path.join('.')}: ${i.message}` : i.message)).join('; ');
