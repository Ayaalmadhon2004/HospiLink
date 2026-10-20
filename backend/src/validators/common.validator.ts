// backend/src/validators/common.validator.ts
import { z } from 'zod';

// All ids in prisma/schema.prisma use @default(uuid()).
export const idSchema = z.string().trim().min(1, 'id is required').uuid('id must be a valid UUID');
export const idParams = z.object({ id: idSchema });

export const nonEmpty = (label: string, max = 255) =>
  z.string().trim().min(1, `${label} is required`).max(max, `${label} is too long`);

// Accepts ISO strings / anything Date.parse understands (the UI sends ISO strings).
export const dateString = (label = 'date') =>
  z.string().min(1, `${label} is required`).refine((v) => !Number.isNaN(Date.parse(v)), `${label} must be a valid date`);

const isNumericString = (v: unknown): v is string =>
  typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v));

// '' / null -> undefined, '12' -> 12, everything else untouched (and then validated).
const normaliseNumber = (v: unknown): unknown => {
  if (v === '' || v === null) return undefined;
  return isNumericString(v) ? Number(v) : v;
};

// Optional number that tolerates form values (see normaliseNumber).
export const looseNumber = (min: number, max: number, opts: { int?: boolean } = {}) => {
  const base = z.number().min(min).max(max);
  return z.preprocess(normaliseNumber, (opts.int ? base.int() : base).optional());
};

// Digits only. Accepts "20", rejects "-1", "2.5" and "abc".
export const digitsString = z.string().regex(/^\d+$/, 'must be a positive integer');
