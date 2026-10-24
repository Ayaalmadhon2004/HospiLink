import { z } from 'zod';

const DEFAULT_PORT = 5000;
const MAX_PORT = 65535;

/** Comma separated list of origins ("https://a.com, http://localhost:5173/") -> trimmed, slash-less, de-duplicated. */
export const parseOrigins = (value: string): string[] =>
  Array.from(new Set(value.split(',').map((o) => o.trim().replace(/\/+$/, '')).filter(Boolean)));

const originsSchema = z
  .string()
  .transform(parseOrigins)
  .pipe(
    z
      .array(z.url({ protocol: /^https?$/ }))
      .min(1, 'at least one http(s) origin is required'),
  );

/**
 * Runtime environment contract. The API refuses to boot when it is not met, so a missing variable
 * is a deploy-time error instead of a request-time surprise. There are no environment-specific defaults here.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(MAX_PORT).default(DEFAULT_PORT),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(1),
  /** Every frontend origin allowed by CORS and Socket.io (localhost, Vercel...). */
  CORS_ORIGINS: originsSchema,
});

export type Env = z.infer<typeof envSchema>;

export const loadEnv = (source: NodeJS.ProcessEnv = process.env): Env => {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid environment configuration - ${problems}`);
  }
  return parsed.data;
};
