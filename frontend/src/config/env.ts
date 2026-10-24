import { z } from 'zod';

/**
 * Build-time environment contract (`VITE_*`). The app refuses to start when it is not met, so a missing
 * API URL fails loudly instead of silently talking to a hardcoded host.
 */
const envSchema = z.object({
  /** API base including the `/api` suffix: an absolute http(s) URL, or a same-origin path such as `/api`. */
  VITE_API_URL: z
    .string()
    .trim()
    .min(1, 'VITE_API_URL is required (e.g. http://localhost:5000/api)')
    .refine((v) => /^https?:\/\//.test(v) || v.startsWith('/'), 'must be an http(s) URL or a path starting with "/"')
    .transform((v) => v.replace(/\/+$/, '')),
});

const parsed = envSchema.safeParse(import.meta.env);
if (!parsed.success) {
  const problems = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
  throw new Error(`Invalid frontend environment - ${problems}`);
}

export const API_URL: string = parsed.data.VITE_API_URL;
/** Socket.io lives on the API host, without the `/api` prefix. */
export const SOCKET_URL: string = API_URL.replace(/\/api$/, '');
