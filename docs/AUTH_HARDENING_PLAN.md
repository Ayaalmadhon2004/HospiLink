# Auth hardening plan: cookies, remember me, password reset / email verification, 2FA

Status: PR 1 (cookies), PR 2 (remember me) and PR 3 (password reset / email verification) are implemented on `claude/friendly-johnson-hvwb1m`; PR 4 (2FA) is still a proposal. The PR 3 section below may differ slightly from the code (the code is authoritative).

Original status: **proposal**. The diffs below are written against `main` as read on 2026-10-23. They are not applied, compiled or tested yet.
Each PR must run `npm test` (backend) and `npm run build && npm run lint && npm test` (frontend) before merge.

## What the code does today (verified)

| Area | Finding | Where |
|---|---|---|
| Remember me | The checkbox state is already sent in the login body, but `loginSchema` strips it. The cookie is always 30 days while the JWT lives 24h, so the cookie outlives the token. | `LoginPage.tsx:15,98`, `auth.validator.ts:19`, `auth.controller.ts:168-173`, `config/jwt.ts:10` |
| Reset / verify | No endpoints, no token table, no mailer (`nodemailer`/Resend not in `package.json`). | `routes/auth.ts` |
| 2FA | `UserSettings.twoFactorAuth` exists but nothing reads it at login. The validator only accepts `false` and the UI toggle is disabled. | `settings.validator.ts:35`, `settings.controller.ts:150`, `SettingsPage.tsx:246-253` |
| Cookies | `sameSite: 'none'` on set and on clear, no `domain`. `*.vercel.app` and `*.onrender.com` are on the Public Suffix List, so the SPA and API are cross-site and the cookie is third-party. | `auth.controller.ts:171,200` |
| Session revocation | `protect` never compares the token's `iat` to anything, so a password change or reset does not log out existing sessions. | `auth.middleware.ts:43-46` |

## Decisions needed (defaults used below)

1. Custom domain: `app.<domain>` (Vercel) and `api.<domain>` (Render). Placeholder: `hospilink.example`.
2. Mail provider: any SMTP URL (`SMTP_URL`), e.g. Resend/SendGrid/Postmark SMTP.
3. Remember-me lifetime: 7 days (JWT and cookie). Without it: 24h JWT in a session cookie (gone when the browser closes).
4. Existing users are backfilled as email-verified so nobody is locked out. New signups must verify before login.
5. 2FA is TOTP (authenticator app) plus 10 single-use recovery codes. Making it mandatory for ADMIN/DOCTOR is a follow-up.

## Delivery: four PRs, branched from `main`, regular merge commits (per CLAUDE.md)

| # | Branch | Issue | Schema change |
|---|---|---|---|
| 1 | `fix/cookie-same-site` | 3 | none |
| 2 | `feat/remember-me` | 1 | none |
| 3 | `feat/password-reset-email-verification` | 1 | migration |
| 4 | `feat/two-factor-auth` | 2 | migration |

PRs 2 to 4 import `config/cookies.ts` from PR 1, so merge PR 1 first. PR 3 and PR 4 each add a migration; keep the timestamps ordered.

---

## PR 1: cookie architecture (Issue 3)

Goal: same-site cookies on a shared parent domain, `SameSite=Lax`, with no breakage for the current Vercel + Render deploy.

**Rollout, in this order**
1. Ship the code with `COOKIE_DOMAIN` unset. Behaviour is unchanged (`none`).
2. Add custom domains: `app.<domain>` on Vercel, `api.<domain>` on Render (TLS is automatic on both).
3. Backend env: `COOKIE_DOMAIN=.hospilink.example`, `CORS_ORIGINS=https://app.hospilink.example`. Frontend env: `VITE_API_URL=https://api.hospilink.example/api`. Redeploy both.
4. After a week with no old-domain traffic, make `COOKIE_DOMAIN` mandatory in production (final hunk below) and delete the `none` branch.

Users re-login once at cut-over because the old host-only cookie is not sent to the new host.

`backend/src/config/cookies.ts` (new)
```ts
import type { CookieOptions } from 'express';

// Read at call time so tests can change the env.
// With COOKIE_DOMAIN set (SPA and API are siblings under one registrable domain) the cookie is
// same-site, so Lax is enough. Without it we keep the legacy cross-site setup (None) until cut-over.
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
```

`backend/src/controllers/auth.controller.ts`
```diff
+import { authCookieOptions, clearCookieOptions } from '../config/cookies';
...
-    res.cookie('token', token, {
-      httpOnly: true,
-      secure: true,
-      sameSite: 'none',
-      maxAge: 30 * 24 * 60 * 60 * 1000,
-    });
+    res.cookie('token', token, authCookieOptions(/* PR 2 passes the lifetime */));
...
-    res.clearCookie('token', {
-      httpOnly: true,
-      secure: true,
-      sameSite: 'none',
-    });
+    res.clearCookie('token', clearCookieOptions());
```

Final hunk (step 4), fail fast in production like `JWT_SECRET`:
```diff
 // config/cookies.ts
+if (process.env.NODE_ENV === 'production' && !process.env.COOKIE_DOMAIN?.trim()) {
+  throw new Error('COOKIE_DOMAIN is required in production (SameSite=Lax needs a shared parent domain)');
+}
```

Docs and config to update in the same PR
- `README.md:248` and `docs/DOCKER.md:60`: describe `COOKIE_DOMAIN` and the Lax setup.
- `backend/.env.example`: `COOKIE_DOMAIN=.example.com` (placeholder).
- Socket.io needs no change: it reads the same `token` cookie from the handshake and the origin is already in `allowedOrigins`.

Security notes
- Lax blocks the cookie on cross-site POST/PUT/DELETE, which is the CSRF protection `none` gave up. GET routes are read-only.
- Do not set the cookie domain to a parent that hosts untrusted subdomains.
- Never put `.vercel.app` or `.onrender.com` in `COOKIE_DOMAIN`; browsers reject it.

Tests: new `tests/config/cookies.test.ts` covering (domain set => lax + domain), (unset => none + secure), (production => secure). Add `expect(res.cookie).toHaveBeenCalledWith('token', expect.any(String), expect.objectContaining({ sameSite: 'lax' }))` in the login test with `COOKIE_DOMAIN` set, and the same for `clearCookie`.

---

## PR 2: remember me (Issue 1, part 1)

Behaviour: checked => 7-day JWT and 7-day persistent cookie; unchecked => 24h JWT and a session cookie. This also fixes the cookie-outlives-JWT mismatch.

`backend/src/config/jwt.ts`
```diff
-export const JWT_EXPIRES_IN = '24h';
+export const SESSION_TTL = {
+  default: { jwt: '24h', cookieMs: undefined },              // session cookie
+  remember: { jwt: '7d', cookieMs: 7 * 24 * 60 * 60 * 1000 },
+} as const;
```
(Update the other importers of `JWT_EXPIRES_IN`: `grep -rn JWT_EXPIRES_IN backend`.)

`backend/src/validators/auth.validator.ts`
```diff
 export const loginSchema = z.object({
   email: ...,
   password: ...,
+  rememberMe: z.boolean().optional().default(false),
 });
```

`backend/src/controllers/auth.controller.ts`
```diff
-const generateToken = (user: {...}): string => {
+const generateToken = (user: {...}, ttl: { jwt: string }): string => {
   return jwt.sign({ userId: user.id, email: user.email, role: user.role }, JWT_SECRET,
-    { expiresIn: JWT_EXPIRES_IN });
+    { expiresIn: ttl.jwt as jwt.SignOptions['expiresIn'] });
 };
...
-    const { email, password } = parsed.data;
+    const { email, password, rememberMe } = parsed.data;
+    const ttl = rememberMe ? SESSION_TTL.remember : SESSION_TTL.default;
...
-    const token = generateToken({ id: user.id, email: user.email, role: user.role });
-    res.cookie('token', token, authCookieOptions());
+    const token = generateToken({ id: user.id, email: user.email, role: user.role }, ttl);
+    res.cookie('token', token, authCookieOptions(ttl.cookieMs));
```

Frontend: `LoginPage` already passes `rememberMe`. Only widen the type.
```diff
 // frontend/src/services/authService.ts
-export const login = async (credentials: { email: string; password: string }) => {
+export const login = async (credentials: { email: string; password: string; rememberMe?: boolean }) => {
```
Also add `htmlFor`/`id` on the checkbox label (accessibility rule in CLAUDE.md).

Tests: login with `rememberMe: true` => cookie `maxAge` 7d and a JWT whose `exp - iat` is 7d; `false`/missing => no `maxAge` and 24h; non-boolean `rememberMe` => 400.

---

## PR 3: password reset and email verification (Issue 1, part 2)

### Schema and migration
```prisma
model User {
  ...
  emailVerifiedAt   DateTime?
  passwordChangedAt DateTime?   // tokens issued before this are rejected
  authTokens        AuthToken[]
}

enum AuthTokenType { PASSWORD_RESET EMAIL_VERIFY }

model AuthToken {
  id        String        @id @default(uuid())
  userId    String
  type      AuthTokenType
  tokenHash String        @unique   // sha256 of the emailed token; the raw token is never stored
  expiresAt DateTime
  usedAt    DateTime?
  createdAt DateTime      @default(now())
  user      User          @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, type])
}
```
Migration SQL must also run the backfill, so existing users keep working:
```sql
UPDATE "User" SET "emailVerifiedAt" = now() WHERE "emailVerifiedAt" IS NULL;
```
Update `prisma/seed.ts` and `seed.e2e.ts` to set `emailVerifiedAt: new Date()`. Admin invite (`users.controller.ts` `inviteUser`) also sets `emailVerifiedAt: new Date()` (the admin vouches for the address).

### Services
`backend/src/services/authTokens.ts` (new)
```ts
import crypto from 'node:crypto';
import prisma from '../config/db';
import type { AuthTokenType } from '@prisma/client';

const sha256 = (v: string) => crypto.createHash('sha256').update(v).digest('hex');

export const issueAuthToken = async (userId: string, type: AuthTokenType, ttlMs: number): Promise<string> => {
  const token = crypto.randomBytes(32).toString('base64url');
  // Only the newest link works.
  await prisma.authToken.updateMany({ where: { userId, type, usedAt: null }, data: { usedAt: new Date() } });
  await prisma.authToken.create({
    data: { userId, type, tokenHash: sha256(token), expiresAt: new Date(Date.now() + ttlMs) },
  });
  return token;
};

/** Returns the userId when the token is valid, unused and unexpired; marks it used atomically. */
export const consumeAuthToken = async (token: string, type: AuthTokenType): Promise<string | null> => {
  const row = await prisma.authToken.findUnique({ where: { tokenHash: sha256(token) } });
  if (!row || row.type !== type || row.usedAt || row.expiresAt < new Date()) return null;
  const { count } = await prisma.authToken.updateMany({ where: { id: row.id, usedAt: null }, data: { usedAt: new Date() } });
  return count === 1 ? row.userId : null;
};
```

`backend/src/services/mailer.ts` (new; `npm i nodemailer` and `npm i -D @types/nodemailer`)
```ts
import nodemailer from 'nodemailer';
import logger from '../config/logger';

const transport = process.env.SMTP_URL ? nodemailer.createTransport(process.env.SMTP_URL) : null;

export const sendMail = async (to: string, subject: string, text: string): Promise<void> => {
  if (!transport) {
    // Never log the body in production: it contains a live token.
    if (process.env.NODE_ENV !== 'production') logger.debug({ to, subject, text }, 'SMTP_URL not set; mail not sent');
    else logger.warn({ subject }, 'SMTP_URL not set; mail not sent');
    return;
  }
  await transport.sendMail({ from: process.env.MAIL_FROM, to, subject, text });
};

// Fragment (#token=) is not sent to servers, proxies or in the Referer header.
export const appLink = (path: string, token: string): string =>
  `${(process.env.APP_URL ?? '').replace(/\/+$/, '')}${path}#token=${token}`;
```

### Validators (`auth.validator.ts`)
```ts
const tokenField = z.string().min(20).max(200);
export const forgotPasswordSchema = z.object({ email: z.string().trim().toLowerCase().email() });
export const resetPasswordSchema = z.object({
  token: tokenField,
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
});
export const verifyEmailSchema = z.object({ token: tokenField });
export const resendVerificationSchema = forgotPasswordSchema;
```

### Controller additions (`auth.controller.ts`)
```ts
const RESET_TTL_MS = 60 * 60 * 1000;         // 1h
const VERIFY_TTL_MS = 24 * 60 * 60 * 1000;   // 24h
const GENERIC = 'If an account exists for this email, we have sent a message.';

export const forgotPassword = async (req: Request, res: Response) => {
  try {
    const parsed = forgotPasswordSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, message: formatZodError(parsed.error) });
    const user = await prisma.user.findUnique({
      where: { email: parsed.data.email }, select: { id: true, email: true, accountStatus: true },
    });
    if (user && user.accountStatus !== 'DISABLED') {
      const token = await issueAuthToken(user.id, 'PASSWORD_RESET', RESET_TTL_MS);
      // Not awaited: response time must not reveal whether the account exists.
      void sendMail(user.email, 'Reset your HospiLink password',
        `Use this link within 1 hour:\n${appLink('/reset-password', token)}\nIf you did not ask for this, ignore this email.`)
        .catch((err) => logger.error({ err }, 'forgotPassword mail failed'));
    }
    return res.status(200).json({ success: true, message: GENERIC });   // same answer either way
  } catch (error: unknown) {
    logger.error({ err: error }, 'forgotPassword error:');
    return res.status(500).json({ success: false, message: 'Request failed' });
  }
};

export const resetPassword = async (req: Request, res: Response) => {
  try {
    const parsed = resetPasswordSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, message: formatZodError(parsed.error) });
    const userId = await consumeAuthToken(parsed.data.token, 'PASSWORD_RESET');
    if (!userId) return res.status(400).json({ success: false, message: 'Invalid or expired link' });
    await prisma.user.update({
      where: { id: userId },
      data: {
        password: await bcrypt.hash(parsed.data.password, 12),
        passwordChangedAt: new Date(),                 // revokes every existing session (see protect)
        emailVerifiedAt: new Date(),                   // they proved they own the mailbox
      },
    });
    // No auto-login: the user signs in with the new password (and 2FA, once PR 4 lands).
    return res.status(200).json({ success: true, message: 'Password updated. You can sign in now.' });
  } catch (error: unknown) {
    logger.error({ err: error }, 'resetPassword error:');
    return res.status(500).json({ success: false, message: 'Request failed' });
  }
};

export const verifyEmail = async (req: Request, res: Response) => {
  // same shape: consumeAuthToken(token, 'EMAIL_VERIFY') -> update emailVerifiedAt: new Date() -> 200 / 400
};

export const resendVerification = async (req: Request, res: Response) => {
  // same shape as forgotPassword: only for users with emailVerifiedAt === null; always answers GENERIC
};
```

`register`: after `prisma.user.create`, issue an `EMAIL_VERIFY` token and `void sendMail(...)` with `appLink('/verify-email', token)`; failures are logged, not returned.

`login`, after the `accountStatus` check:
```ts
if (!user.emailVerifiedAt) {
  res.status(403).json({ success: false, message: 'Please verify your email address', code: 'EMAIL_NOT_VERIFIED' });
  return;
}
```

`updatePassword`: add `passwordChangedAt: new Date()` to the update, then re-issue the cookie so the current device stays signed in (other devices are revoked). Also validate the body with zod; today `newPassword` has no length rule and `req.body` is untyped.

### Session revocation (`auth.middleware.ts` and `socket.auth.ts`)
```diff
-      select: { id: true, email: true, role: true, hospitalId: true, accountStatus: true },
+      select: { id: true, email: true, role: true, hospitalId: true, accountStatus: true, passwordChangedAt: true },
 ...
+    // Tokens issued before the last password change/reset are dead.
+    if (user.passwordChangedAt && (decoded.iat ?? 0) < Math.floor(user.passwordChangedAt.getTime() / 1000)) {
+      return res.status(401).json({ error: 'Session expired, please sign in again' });
+    }
```
Apply the same check in `socketAuth`.

### Routes and rate limiting
```diff
 router.post('/login', login);
+router.post('/forgot-password', mailLimiter, forgotPassword);
+router.post('/reset-password', resetPassword);
+router.post('/verify-email', verifyEmail);
+router.post('/resend-verification', mailLimiter, resendVerification);
```
`mailLimiter`: `express-rate-limit`, 5 requests per hour per IP, so the endpoint cannot be used to mail-bomb a victim. `/api/auth` already has the 20 per 15 min limiter.

### Frontend
- `services/authService.ts`: `forgotPassword(email)`, `resetPassword(token, password)`, `verifyEmail(token)`, `resendVerification(email)` via `apiPost`.
- New pages `ForgotPasswordPage`, `ResetPasswordPage`, `VerifyEmailPage`. Read `location.hash`, call `history.replaceState` to drop the token from the URL immediately, then POST. Register them as public routes in `App.tsx` (lazy) next to `/login`.
- `LoginPage`: "Forgot password?" link; on `EMAIL_NOT_VERIFIED` show a "Resend verification email" button.
- `api.ts` response interceptor currently collapses every other 403 into the generic `errors.forbidden`; add the new code or the login page never sees the message:
```diff
-    if (error.response?.status === 403 && (code === 'ACCOUNT_PENDING' || code === 'ACCOUNT_DISABLED')) {
+    if (error.response?.status === 403 && (code === 'ACCOUNT_PENDING' || code === 'ACCOUNT_DISABLED' || code === 'EMAIL_NOT_VERIFIED')) {
```
- i18n: add keys to both `en.json` and `ar.json` (CLAUDE.md: i18n covers every page).
- Env: backend `APP_URL=https://app.hospilink.example`, `SMTP_URL`, `MAIL_FROM` (placeholders in `.env.example`).

Tests: new controller paths each need happy path + 400/404-equivalent: forgot (known, unknown, disabled: all 200 and identical body; mail called only for the known one), reset (valid, expired, reused, wrong type, short password), verify (valid/invalid/expired), login (403 `EMAIL_NOT_VERIFIED`), `protect` (token older than `passwordChangedAt` => 401), `consumeAuthToken` concurrency (second call returns `null`). Update the register test (token + mail issued) and the existing login fixtures (`emailVerifiedAt`).

---

## PR 4: two-factor authentication (Issue 2)

Chosen design: TOTP (RFC 6238) via `otplib@12.0.1` (pin exactly; v13 changed the API), 10 recovery codes, secret encrypted at rest with AES-256-GCM.

### Schema
```prisma
model User {
  ...
  twoFactorSecretEnc   String?      // iv:tag:ciphertext (base64url). Set at setup, active only when twoFactorEnabledAt is set
  twoFactorEnabledAt   DateTime?
  twoFactorLastStep    Int?         // last accepted TOTP time-step (replay protection)
  twoFactorFailures    Int          @default(0)
  twoFactorLockedUntil DateTime?
  recoveryCodes        TwoFactorRecoveryCode[]
}

model TwoFactorRecoveryCode {
  id       String    @id @default(uuid())
  userId   String
  codeHash String
  usedAt   DateTime?
  user     User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}
```
`User.twoFactorEnabledAt` is the single source of truth. `UserSettings.twoFactorAuth` stays in the schema but is no longer read; drop it in a later migration. `settings.controller.getSettings` returns `twoFactorAuth: Boolean(user.twoFactorEnabledAt)`.

### Secret encryption (`backend/src/config/twoFactor.ts`, new)
```ts
import crypto from 'node:crypto';

// 32 random bytes, base64. Generate with: openssl rand -base64 32
const key = (): Buffer => {
  const k = Buffer.from(process.env.TWO_FACTOR_ENC_KEY ?? '', 'base64');
  if (k.length !== 32) throw new Error('TWO_FACTOR_ENC_KEY must be 32 bytes, base64 encoded');
  return k;
};

export const encryptSecret = (plain: string): string => {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const ct = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return [iv, c.getAuthTag(), ct].map((b) => b.toString('base64url')).join(':');
};

export const decryptSecret = (stored: string): string => {
  const [iv, tag, ct] = stored.split(':').map((p) => Buffer.from(p, 'base64url'));
  const d = crypto.createDecipheriv('aes-256-gcm', key(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(ct), d.final()]).toString('utf8');
};
```
The key is read lazily so the app still boots without it; 2FA endpoints fail with 500 until it is set. Add `TWO_FACTOR_ENC_KEY=` (placeholder) to `.env.example` and to `tests/setup.ts`.

### Endpoints (`controllers/twoFactor.controller.ts`, routes under `/api/auth/2fa`)

| Route | Auth | Body | Effect |
|---|---|---|---|
| `POST /2fa/setup` | `protect` | none | 409 if already enabled. Generates secret, stores it encrypted, returns `{ secret, otpauthUrl }`. |
| `POST /2fa/enable` | `protect` | `{ code }` | Verifies against the pending secret, sets `twoFactorEnabledAt`, returns 10 recovery codes **once** (stored as sha256). |
| `POST /2fa/disable` | `protect` | `{ password, code }` | Needs current password and a TOTP or recovery code. Clears secret and codes. |
| `POST /2fa/login` | public + limiter | `{ challengeToken, code }` or `{ challengeToken, recoveryCode }` | Completes login, sets the cookie. |

Core verification helper (replay-safe and race-safe):
```ts
import { authenticator } from 'otplib';
authenticator.options = { window: 1 };            // ±30s clock drift

const STEP_MS = 30_000;
const MAX_FAILURES = 5;
const LOCK_MS = 15 * 60 * 1000;

/** true => accepted. Burns the time-step so the same code cannot be used twice. */
const verifyTotp = async (user: { id: string; twoFactorSecretEnc: string; twoFactorLastStep: number | null }, code: string) => {
  const delta = authenticator.checkDelta(code, decryptSecret(user.twoFactorSecretEnc));
  if (delta === null) return false;
  const step = Math.floor(Date.now() / STEP_MS) + delta;
  const { count } = await prisma.user.updateMany({
    where: { id: user.id, OR: [{ twoFactorLastStep: null }, { twoFactorLastStep: { lt: step } }] },
    data: { twoFactorLastStep: step },
  });
  return count === 1;
};
```
Recovery codes: `crypto.randomBytes(5).toString('hex')` formatted `xxxxx-xxxxx`; on use, `updateMany({ where: { userId, codeHash, usedAt: null }, data: { usedAt: new Date() } })` and require `count === 1`.

Lockout: on a failed code in `/2fa/login` increment `twoFactorFailures`; at 5 set `twoFactorLockedUntil = now + 15 min` and answer 429 until then; reset to 0 on success. A per-IP `express-rate-limit` (10 per 15 min) sits in front of it too.

### Login flow (`auth.controller.ts`)
Split the end of `login` into a shared `completeLogin(res, user, rememberMe)` (sets the cookie, returns the public user) and call it from both paths. After the password, status and email-verified checks:
```ts
if (user.twoFactorEnabledAt) {
  // No cookie yet. The challenge only proves "password was correct", valid 5 minutes, useless on protected routes.
  const challengeToken = jwt.sign({ uid: user.id, purpose: '2fa', rememberMe }, JWT_SECRET, { expiresIn: '5m' });
  res.status(200).json({ success: true, twoFactorRequired: true, challengeToken });
  return;
}
return completeLogin(res, user, rememberMe);
```
`/2fa/login` verifies the challenge (`purpose === '2fa'`), reloads the user, re-checks `accountStatus`, verifies the code or recovery code, then calls `completeLogin`.

`protect` must reject challenge tokens explicitly instead of relying on Prisma throwing for `id: undefined`:
```diff
     const decoded = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload & { userId?: string; purpose?: string };
+    if (typeof decoded.userId !== 'string' || decoded.purpose) {
+      return res.status(401).json({ error: 'Invalid or expired token' });
+    }
```
(`socketAuth` already rejects tokens without a string `userId`.)

**Do not leak the new columns.** `login` currently returns `{ password: _, ...user }` from a full-row `include`, which would now include `twoFactorSecretEnc`, lockout counters and `passwordChangedAt`. Replace it with a `toPublicUser(user)` helper that picks fields (the `select` list in `getMe` is the model). Add `emailVerifiedAt` and `twoFactorEnabled: boolean` to `getMe`'s response. Add a test asserting the login response has none of the secret fields.

### Settings alignment
```diff
 // settings.validator.ts
-  // 2FA is not implemented: only "off" is accepted so the UI can never show a false sense of security.
-  twoFactorAuth: z.literal(false, { message: 'Two-factor authentication is not available yet' }).optional(),
+  // Managed only through /api/auth/2fa/*; a toggle sent here must never be silently ignored.
+  twoFactorAuth: z.never({ message: 'Manage two-factor authentication via /api/auth/2fa' }).optional(),
```
Update `settings.validator.test.ts` (lines 29 and 33: both `true` and `false` are now rejected) and `settings.controller.test.ts:187-197` (still true: never persisted from this route). Remove the "coming soon" copy from `en.json` and `ar.json`.

### Frontend
- `authService.ts`: `login` returns `{ twoFactorRequired?, challengeToken?, user? }`; add `verifyTwoFactor(challengeToken, { code } | { recoveryCode })`, `setupTwoFactor()`, `enableTwoFactor(code)`, `disableTwoFactor(password, code)`.
- `LoginPage.tsx`: new state `challenge: string | null`, kept only in React state (never in storage).
```diff
       const data = await login(formData);
-      if (data.user) {
+      if (data.twoFactorRequired && data.challengeToken) {
+        setChallenge(data.challengeToken);       // render the code step instead of redirecting
+      } else if (data.user) {
         window.location.href = '/dashboard';
```
  The code step is one input with `inputMode="numeric"`, `autoComplete="one-time-code"`, `maxLength={11}`, plus a "Use a recovery code" toggle. On success it redirects to `/dashboard`.
- `SettingsPage.tsx`: replace the disabled `Toggle` (lines 246-253) with a `TwoFactorPanel` component: Enable => `setup` => QR rendered locally with `qrcode.react` (never send the secret to an online QR service) plus the text secret => enter code => show recovery codes once with a copy/download button and an "I saved them" confirmation. Disable asks for password and code. It uses `useCrud`/React Query like the other settings.
- Update `e2e/mockApi.ts` if the login mock shape changes.

### Follow-ups (not in this PR)
- Mandatory 2FA for ADMIN/DOCTOR via an env list (`REQUIRE_2FA_ROLES`) with an enrol-first redirect.
- Admin action to reset a user's 2FA (audited with `logActivity`).
- Regenerate recovery codes; email notice when 2FA is enabled/disabled or a recovery code is used.

Tests: setup (409 when enabled), enable (wrong code 400, right code returns 10 codes and stores hashes only), login with 2FA (no cookie + `twoFactorRequired`), `/2fa/login` (valid, wrong, replayed code, expired or wrong-purpose challenge, recovery code usable once, lockout after 5 failures => 429, DISABLED account), `protect` rejects a challenge token, encrypt/decrypt round trip and tamper detection.

---

## Cross-cutting checklist

- Update `CLAUDE.md` "Known issues": remove the cookie `none` note, record `COOKIE_DOMAIN`, `APP_URL`, `SMTP_URL`, `MAIL_FROM`, `TWO_FACTOR_ENC_KEY` under environment variables.
- Every new mutating route gets `logActivity(...)` where an authenticated user exists (`2FA_ENABLED`, `2FA_DISABLED`, `PASSWORD_CHANGED`). Unauthenticated routes (reset, verify) cannot, so log through `logger` without token values.
- Never log tokens, TOTP secrets or recovery codes.
- Real-backend e2e (`e2e-real`): add a reset-password spec only if a test mail sink is available; otherwise cover through jest.
