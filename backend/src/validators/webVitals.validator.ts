import { z } from 'zod';

// Anonymous Core Web Vitals sample. Strict: unknown keys are rejected so nothing else can be smuggled in.
export const WEB_VITAL_NAMES = ['CLS', 'INP', 'LCP', 'FCP', 'TTFB'] as const;
export const WEB_VITAL_RATINGS = ['good', 'needs-improvement', 'poor'] as const;

const MAX_VALUE = 10 * 60 * 1000; // ms; nothing sane is above ten minutes
const MAX_ID_LENGTH = 64;
const MAX_PATH_LENGTH = 100;

// Only a normalised route: starts with "/", no query string, hash, whitespace or control characters.
const pathSchema = z
  .string()
  .max(MAX_PATH_LENGTH)
  .regex(/^\/[A-Za-z0-9/_:.-]*$/, 'path must be a plain route without query string or hash');

export const webVitalSchema = z
  .object({
    name: z.enum(WEB_VITAL_NAMES),
    value: z.number().finite().min(0).max(MAX_VALUE),
    rating: z.enum(WEB_VITAL_RATINGS),
    path: pathSchema,
    id: z.string().regex(/^[A-Za-z0-9._-]+$/).max(MAX_ID_LENGTH).optional(),
  })
  .strict();

export type WebVitalReport = z.infer<typeof webVitalSchema>;
