# HospiLink

Hospital management platform: patients, beds/wards, vitals monitoring, appointments,
incidents, staff/shifts, ambulance dispatch, notifications. Monorepo with two apps:

- `backend/`  — Node.js + Express 5 + TypeScript + Prisma 7 (PostgreSQL on Neon) + Socket.io
- `frontend/` — React 19 + Vite 8 + TypeScript + Tailwind 4 + React Query 5

Deploy: frontend on Vercel, backend on Render. Team comments are often in Arabic/Levantine; code and
identifiers are English. Keep that convention.

## Repo layout

```
backend/
  src/server.ts            app bootstrap, helmet/CORS/rate-limit, socket.io, route mounting
  src/config/              db.ts (Prisma + PrismaPg adapter), jwt.ts
  src/routes/              one file per resource -> /api/<resource>
  src/controllers/         request handlers (Prisma calls live here)
  src/middlewares/         auth (protect/authorize), audit (logActivity), error, upload, dispatch.socket
  src/validators/          zod schemas, one file per resource (wired via middlewares/validate)
  src/types/               shared types, express.d.ts
  prisma/schema.prisma     data model;  prisma/seed.ts
  tests/                   jest + ts-jest; mocks in tests/mocks (prisma, io, http)
frontend/
  src/App.tsx              routes (all pages lazy-loaded, wrapped in PrivateRoute)
  src/pages/               one page per route
  src/components/          UI; components/Form = generic FormModal/FieldRenderer
  src/configs/entityConfigs.ts   declarative form/entity definitions
  src/hooks/               useCrud (optimistic CRUD), use*Socket, useSettings, useNotifications
  src/services/            axios API layer (api.ts = instance + interceptors)
  src/contexts/AuthContext.tsx
docs/                      design notes (docs/vitals/DATA_FLOW.md)
ci-cd.yml (.github/workflows)  GitHub Actions pipeline (see "Known issues")
```

## Commands

Backend (`cd backend`):
- `npm install`            install (use `npm ci` in CI)
- `npx prisma generate`    needs `DATABASE_URL` set (prisma.config.ts reads it)
- `npm run dev`            tsx watch on src/server.ts (port 5000 by default)
- `npm run build`          `tsc` -> dist/;  `npm start` runs dist/server.js
- `npm test`               jest (268 tests, no DB needed: Prisma is mocked)
- `npm run test:coverage`  current coverage ~88% statements

Frontend (`cd frontend`):
- `npm install`
- `npm run dev`            Vite on :5173
- `npm run build`          `tsc -b && vite build`
- `npm run lint`           eslint (currently clean)
- `npm test`               vitest (45 tests)
- `npm run preview`        serves build on :4173
- `npm run test:e2e`       Playwright (chromium), API mocked in-browser via `e2e/mockApi.ts`; no backend/DB needed.
                           First time: `npx playwright install chromium`. Files are `e2e/*.e2e.ts`.

## Environment variables

Backend `.env` (never commit; `.env.example` must contain placeholders only):
- `DATABASE_URL`  PostgreSQL connection string
- `JWT_SECRET`    required, long random string; the app must not start without it
- `PORT`          default 5000
- `NODE_ENV`      `production` disables dev logging
- `SENTRY_DSN`    optional; enables error reporting to Sentry (no PII is sent)

Frontend: `VITE_API_URL` (defaults to the Render API URL in `services/api.ts`).

## Backend conventions (Node / Express)

- Layering: route -> middleware(s) -> controller -> Prisma. Keep business logic out of routes.
- Every route except login/signup/health must use `protect`; restrict with
  `authorize('ADMIN', 'DOCTOR', ...)`. Roles come from the DB (`protect` reloads the user), never from the token body.
- Roles: ADMIN, DOCTOR, NURSE, DISPATCHER (see `Role` enum in schema.prisma).
- Wrap mutating routes in `logActivity('ACTION_NAME')` (audit.middleware) so they land in `AuditLog`.
- Validate request bodies with zod (`src/validators/`), return 400 with a clear message. Do not trust `req.body`.
- Response shape: `{ success, message?, data? }` on success/failure; auth middleware currently uses `{ error }`.
  Prefer the `success` shape for new code.
- Errors: throw/forward to `errorHandler` where possible; do not leak `error.message` of internal errors to clients.
- Auth: JWT (24h) accepted via `Authorization: Bearer` or httpOnly cookie `token`.
  Passwords hashed with bcryptjs (12 rounds).
- Sockets: `io` is created in server.ts; rooms are `patient-<id>`, `department-<name>`, `dispatch-room`, `unit-<id>`.
  Controllers emit events (vitals, incidents, appointments, dispatch, notifications) to those rooms.
- File uploads: multer memory storage, saved in `Report.fileData` (jpeg/png/pdf, 5MB) and served by `GET /api/patients/reports/:reportId/file`. Older reports may still point to `/uploads/...` on disk. Uploaded files are patient data: never commit them.
- Use the shared Prisma client from `src/config/db.ts`; do not instantiate new clients.
- TypeScript: avoid `any`; type request bodies and use `Prisma` generated types.

## Frontend conventions (React)

- Function components + hooks only. Pages are default or named exports lazy-loaded in `App.tsx`;
  add new pages there inside `PrivateRoute` and in `Sidebar`.
- Server state through React Query; mutations via `hooks/useCrud.ts` (optimistic updates, rollback on error).
- All HTTP goes through `services/api.ts` (`api`, `apiGet/apiPost/apiPut/apiDelete`). Never call axios/fetch directly
  in components. Interceptor attaches Bearer token and normalises error messages.
- Real-time: one `use*Socket` hook per domain; always clean up listeners in the effect cleanup.
- Forms: define fields declaratively in `configs/entityConfigs.ts` and render with `components/Form/*`
  instead of hand-writing new modal forms.
- Styling: Tailwind utility classes (v4, `@tailwindcss/vite`); icons from `lucide-react`; toasts via `sonner`;
  charts via `recharts` only (chart.js was removed).
- Keep bundles small: lazy-load pages and heavy libs; `vite.config.ts` has manualChunks for react/query/charts/icons.
- Accessibility: labels on inputs, aria attributes on icon-only buttons, sufficient colour contrast
  (Lighthouse a11y is ~93; color-contrast is the known failing audit).
- TypeScript strict; avoid `any`, type API responses. Lint must pass before merging.

## How the two sides connect

- Base URL: `VITE_API_URL` + `/api/<resource>`. Resources: auth, patients, beds, wards, vitals, staff,
  appointments, dispatch, incidents, notifications, settings.
- CORS allowlist lives in `backend/src/server.ts` (`allowedOrigins`) and must include every frontend origin
  (localhost:5173, localhost:4173, Vercel domains). Credentials are enabled.
- Socket.io client in `frontend/src/hooks/use*Socket.ts` connects to the same host as the API (without `/api`).
- When you change an endpoint or payload, update: the controller, its route, the zod validator,
  the jest test, the frontend service in `services/`, the types, and any `entityConfigs` field.
- DB changes: edit `schema.prisma`, create a migration (`npx prisma migrate dev`), update `seed.ts`,
  then adjust controllers and frontend types.

## Testing

- Backend tests live in `backend/tests/**` mirroring `src/`. Prisma and socket.io are mocked via
  `tests/mocks/*`; add a test for every new controller path (happy path + 400/401/403/404).
- Frontend: Vitest + Testing Library for units; Playwright (`frontend/e2e`) covers login, the private-route redirect and the patients list/search/detail flow against a mocked API. Extend `mockApi.ts` when adding flows. These do NOT exercise the real backend.
- Run `npm test` (backend) and `npm run build && npm run lint` (frontend) before pushing.

## Known issues / priorities (keep this list current)

Open:
- `prisma/migrations` holds the baseline (`00000000000000_baseline`) and `20261020000000_report_file_data` (adds `Report.fileData`); production must run `migrate resolve --applied` for the baseline once (see `docs/MIGRATIONS.md`) before `migrate deploy` is used.
- Some `console.*` calls remain in the frontend (33 calls in 13 files under `frontend/src`; none in `backend/src`); use a logger.
- Legacy uploads under `/uploads` live on Render's ephemeral disk (new ones are stored in the DB). Frontend test coverage is minimal (unit tests plus a small mocked-API E2E suite; no real-backend E2E).
- i18n, PWA, Web Vitals and Docker are not implemented (README lists them under Roadmap).
- The credentials once committed in `backend/.env.example` must stay rotated (they remain in git history).

Fixed on main (do not reintroduce): `.github/workflows/ci-cd.yml` has no `continue-on-error`, so lint, build and tests are strict in CI; report files are stored in the DB (`Report.fileData`); zod validation covers every resource route via `validate({ params, query, body })` (auth validates in its controller; `GET /wards` has no input); `.env.example` holds placeholders only; `JWT_SECRET` has no fallback;
public signup ignores `role`/`hospitalId`; staff, shifts, reports and `/uploads` require auth; Socket.io
requires a JWT (`socketAuth`); the token is no longer kept in `localStorage` (httpOnly cookie);
`backend/uploads/` contents are untracked; both `package-lock.json` files are committed; README was
rewritten and stray root files and "Muraqib" wording were removed; zod validation is wired into every
resource route (patients included); `new-notification` reaches users through the `user-<id>` room joined in
`socketAuth`; vitals with missing metrics no longer produce NaN; list requests no longer send
`status=undefined` (use `toQueryString()` from `types/api.ts` for query strings, never raw `URLSearchParams`
with possibly-undefined values); the patient admit form offers only MALE/FEMALE (the `Gender` enum).

## Working rules for Claude

- Make small, focused changes; edit existing files rather than rewriting them.
- Never print, commit, or log secrets. Use placeholders in examples.
- Do not weaken auth, CORS, rate limits or helmet settings to make something work.
- Run the relevant tests/build before committing; report failures honestly.
- Commit on the assigned feature branch only; do not open PRs unless asked.

## Git, PR and authorship rules

- Every feature/fix goes in its own branch and its own PR, branched from `main`. Keep PRs small and independent;
  split overlapping files so each PR carries only its own hunks.
- Branch names: `fix/<topic>`, `feat/<topic>`, `chore/<topic>`, `docs/<topic>`.
- Authorship: the repo owner (Aya almadhon, `Ayaalmadhon2004 <aya.alaasel123@gmail.com>`) must be the author
  of every commit and of every PR/merge. Before committing run
  `git config user.name "Ayaalmadhon2004"` and `git config user.email "aya.alaasel123@gmail.com"`.
  Do NOT add `Co-Authored-By: Claude`, `Claude-Session`, "Generated with Claude Code" or any other
  Claude/AI attribution to commit messages, PR titles or PR descriptions.
- Merge PRs with a regular merge commit (`merge`), never squash and never rebase-merge, so each commit stays visible in history.
- Never force-push `main`. Rewrite history only on your own unmerged feature branches (`--force-with-lease`).
