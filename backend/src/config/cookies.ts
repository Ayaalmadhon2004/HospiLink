// backend/src/config/cookies.ts
import type { CookieOptions } from 'express';

// Read at call time so tests can change the env.
// With COOKIE_DOMAIN set (SPA and API are siblings under one registrable domain, e.g. app.x.com / api.x.com)
// the cookie is same-site, so Lax is enough. Without it we keep the legacy cross-site setup (None).
const options = (): CookieOptions => {
  const domain = process.env.COOKIE_DOMAIN?.trim() || undefined;
  const sameSite = domain ? 'lax' : 'none';
  return {
    httpOnly: true,
    secure: sameSite === 'none' || process.env.NODE_ENV === 'production',
    sameSite,
    path: '/',
    ...(domain ? { domain } : {}),
  };
};

/** maxAgeMs undefined => session cookie. */
export const authCookieOptions = (maxAgeMs?: number): CookieOptions => ({
  ...options(),
  ...(maxAgeMs ? { maxAge: maxAgeMs } : {}),
});

// clearCookie only works when domain/path/sameSite match what was set.
export const clearCookieOptions = (): CookieOptions => options();
