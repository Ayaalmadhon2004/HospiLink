import rateLimit from 'express-rate-limit';

// Production limits are the defaults below. The real-backend E2E suite raises them through env
// because one browser session hits /api/auth/me on every page load; nothing else sets these.
export const limitFromEnv = (name: string, fallback: number): number => {
  const n = Number(process.env[name]);
  return Number.isInteger(n) && n > 0 ? n : fallback;
};

// The SPA calls GET /api/auth/me on every page load; many staff behind one hospital NAT share an IP,
// so it must not consume the strict brute-force budget of login/register/reset/2fa.
// `path` is relative to the /api/auth mount.
export const isSessionProbe = (req: { method: string; path: string }): boolean =>
  req.method === 'GET' && req.path.replace(/\/+$/, '') === '/me';

// Brute-force protection for everything under /api/auth except GET /me.
export const createAuthLimiter = () =>
  rateLimit({
    skip: isSessionProbe,
    windowMs: 15 * 60 * 1000,
    max: limitFromEnv('AUTH_RATE_LIMIT_MAX', 20), // 20 requests per 15 min per IP
    message: { success: false, message: 'Too many authentication attempts. Please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
  });

// GET /api/auth/me has its own, more generous per-IP limit (never unlimited).
export const createMeLimiter = () =>
  rateLimit({
    skip: (req) => !isSessionProbe(req),
    windowMs: 60 * 1000,
    max: limitFromEnv('ME_RATE_LIMIT_MAX', 120), // 120 requests per minute per IP
    message: { success: false, message: 'Too many requests. Please slow down.' },
    standardHeaders: true,
    legacyHeaders: false,
  });
