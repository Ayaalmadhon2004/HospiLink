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
- `npm run lint`           eslint + typescript-eslint (`no-explicit-any` is an error in src; CI runs it)
- `npm test`               jest (no DB needed: Prisma is mocked)
- `npm run test:coverage`  current coverage ~88% statements
- `npm run test:int`       integration suite on a REAL PostgreSQL (`tests-int/`, needs `INT_DATABASE_URL` -> a throwaway db whose name contains `test`/`e2e`; applies the migrations, truncates between tests, boots the real server for sockets). See `docs/INTEGRATION_TESTS.md`.

Frontend (`cd frontend`):
- `npm install`
- `npm run dev`            Vite on :5173
- `npm run build`          `tsc -b && vite build`
- `npm run lint`           eslint (currently clean)
- `npm test`               vitest (~290 tests)
- `npm run preview`        serves build on :4173
- `npm run test:e2e`       Playwright (chromium), API mocked in-browser via `e2e/mockApi.ts`; no backend/DB needed.
                           First time: `npx playwright install chromium`. Files are `e2e/*.e2e.ts`.
- `npm run test:e2e:real`  Playwright against the REAL backend + a throwaway PostgreSQL (`playwright.real.config.ts`, files in
                           `e2e-real/*.e2e.ts`). Needs `E2E_DATABASE_URL` (db name must contain `e2e` or `test`); the config runs
                           `prisma migrate deploy` + `backend/prisma/seed.e2e.ts`, starts the API on :5000 and the built app on
                           localhost:4173. Recreate the database between runs. See `docs/E2E_REAL.md`.

## Environment variables

Backend `.env` (never commit; `.env.example` must contain placeholders only):
- `DATABASE_URL`  PostgreSQL connection string
- `JWT_SECRET`    required, long random string; the app must not start without it
- `PORT`          default 5000
- `CORS_ORIGINS`  required, comma separated frontend origins for CORS + Socket.io (no built-in defaults; validated with zod in `config/env.ts`, the API refuses to boot without it)
- `NODE_ENV`      `production` disables dev logging
- `COOKIE_DOMAIN` optional; shared parent domain (e.g. `.example.com`) switches the auth cookie to SameSite=Lax (default: SameSite=None)
- `APP_URL`, `SMTP_URL`, `MAIL_FROM`  frontend URL used in emailed links and the SMTP transport for password reset / email verification
                 (without `SMTP_URL` mails are only logged in dev, never sent)
- `TWO_FACTOR_ENC_KEY`  32 random bytes, base64 (`openssl rand -base64 32`); encrypts TOTP secrets, required to use 2FA (the API boots without it, the `/auth/2fa/*` endpoints fail)
- `AUTH_RATE_LIMIT_MAX`, `API_RATE_LIMIT_MAX`  TEST ONLY overrides of the auth (20 / 15 min) and API (200 / min) per-IP limits; set by the real-backend Playwright config, never in production
- `INGEST_RATE_LIMIT_MAX`  optional, requests/minute allowed per authenticated device key on `/api/vitals/ingest/*` (default 6000). Ingest is exempt from the general per-IP API limiter on purpose (one hospital gateway carries every bedside device); rejected requests (bad key/payload) are limited per IP (60/min) instead
- `SENTRY_DSN`    optional; enables error reporting to Sentry (no PII is sent)

Frontend: `VITE_API_URL` required, API base incl. `/api` (validated in `src/config/env.ts`, no fallback; see `frontend/.env.example`). Optional `VITE_DEV_PROXY_TARGET` for the Vite dev proxy.

## Backend conventions (Node / Express)

- Layering: route -> middleware(s) -> controller -> Prisma. Keep business logic out of routes.
- Every route except login/signup/health must use `protect`; restrict with
  `authorize('ADMIN', 'DOCTOR', ...)`. Roles come from the DB (`protect` reloads the user), never from the token body.
- Roles: ADMIN, DOCTOR, NURSE, DISPATCHER (see `Role` enum in schema.prisma).
- Password reset / email verification: `POST /api/auth/{forgot-password,reset-password,verify-email,resend-verification}`; single-use hashed tokens in `AuthToken`
  (`services/authTokens.ts`), links carry the token in the URL fragment. New signups must verify their email before login (403 `EMAIL_NOT_VERIFIED`); admin-invited
  users and pre-existing users are verified. `User.passwordChangedAt` revokes older tokens in `protect` and `socketAuth`.
- 2FA (TOTP via `otplib`): `User.twoFactorEnabledAt` is the source of truth (`UserSettings.twoFactorAuth` is no longer read; `PUT /settings/security` rejects `twoFactorAuth`).
  Login with 2FA answers `{ twoFactorRequired, challengeToken }` (5 min, no cookie; `protect` rejects it) and `POST /api/auth/2fa/login` sets the cookie. Setup/enable/disable live in
  `controllers/twoFactor.controller.ts`; codes are replay-protected, 5 wrong codes lock the account's 2FA for 15 min, recovery codes are stored hashed (`POST /auth/2fa/recovery-codes` regenerates them with password + code; `POST /users/:id/2fa/reset` lets an ADMIN of the same hospital clear a user's 2FA and revoke their sessions). Enabling/disabling/resetting 2FA, regenerating codes and using a recovery code email a notice (`services/securityNotices.ts`). Never return raw `User` rows: use `toPublicUser`.
- Staff <-> login: `Staff.userId` (unique, nullable FK to `User`, `SetNull`) is the only link. Appointment/shift notifications and reminders go to `staff.userId`; staff without one are
  logged and skipped (the directory shows a "No login" badge). Never match `Staff.email` with `User.email` at runtime. The link is made once: `POST /staff` (with `loginRole` it also creates the login
  and emails a set-password link), invite/approve of a user, a staff email correction, or `PUT /staff/:id/login { userId | null }` (ADMIN). Only same-hospital records are ever linked; `userId` is never exposed
  (the API returns `hasLogin`).
- Appointments: a doctor cannot have overlapping non-cancelled appointments (`services/appointmentConflicts.ts`, each with its own `duration`, also checked on update) and a DB exclusion constraint closes the race.
  An appointment always references an existing patient (`patientId`/`patientCode`); it never creates patients.
- Dispatch lifecycle: the unit <-> call link changes ONLY through `POST /dispatch/calls/:id/assign`, `/complete` and `/cancel` (the last two close the call and release the unit in one transaction;
  `PUT /dispatch/units/:id/status` never takes a `callId` and refuses AVAILABLE/OFF_DUTY for a unit that is on a call; EN_ROUTE/ON_SCENE are mirrored on the call). `DispatchCall.assignedUnitId` is history only (not unique).
  Units: `POST/PUT/DELETE /dispatch/units` (delete = ADMIN, refused while on a call). Socket `unit-location-update` (DISPATCHER/ADMIN) is broadcast as `unit-location` to the dispatch and unit rooms.
- Doctors: `Patient.doctorId` and `Appointment.doctorId` both reference `Staff` (the login, if any, is `Staff.userId`; `notify` recipients use it). Never point a doctor FK at `User`.
- Patients are soft-deleted: `DELETE /patients/:id` (ADMIN) sets `Patient.deletedAt` and frees the bed; a DB trigger rejects hard deletes. Every read of patients (and of relations scoped through `patient: { ... }`) must include `deletedAt: null`; only `nextPatientNumber` counts deleted rows (codes stay unique).
- Referential actions are explicit in `schema.prisma`: Bed/Incident/Staff -> Hospital and Bed -> Ward are `Restrict`, `Shift -> Staff` cascades, `AuditLog.userId` is nullable + `SetNull` (the trail outlives users).
- Device vitals ingestion: `POST /api/vitals/ingest/{hl7|fhir|json}` authenticated by `x-device-key` (rate limits: per device key after auth + per-IP on rejected requests, NOT the general per-IP limiter; see `INGEST_RATE_LIMIT_MAX`) (`DeviceKey`, hashed, hospital-bound, ADMIN manages via `/api/devices`); adapters in `services/vitalsAdapters.ts` are pure, the shared pipeline is `services/vitalsIngest.ts` (also used by `POST /vitals`). See `docs/VITALS_INTEGRATION.md`. Backups/retention: `docs/BACKUP_AND_RETENTION.md`; remaining work: `docs/ROADMAP.md`.
- Wards: `POST/PUT/DELETE /wards` (ADMIN; name unique per hospital case-insensitively -> 409; delete answers 409 `WARD_HAS_BEDS` while beds exist). `GET /wards` includes `_count.beds`. UI: `components/Wards/WardsPanel` on the Beds page, gated by `wards:manage`.
- User roles: `PUT /users/:id/role` (never your own; 409 `PENDING` users; keeps >=1 ACTIVE ADMIN via a serializable transaction -> 409 `LAST_ADMIN`; bumps `passwordChangedAt` so the user's sessions/socket rooms are revoked and emails a notice) and `PUT /users/:id/activate { role }` (DISABLED -> ACTIVE, role mandatory because a rejected signup only has a placeholder). UI: `/users` (ADMIN), `pages/UsersPage`.
- Clinical records (hospital-scoped, patient must be same hospital and not soft-deleted; `services/clinicalAccess.ts`): `ClinicalNote` is append-only (DB trigger rejects UPDATE/DELETE; `POST /clinical-notes/:id/amend` adds a row with `supersedesId`, unique so history is a chain; list returns current versions only; authors are stored as `authorId` + `authorName` snapshot; DOCTOR writes every type, NURSE only NURSING). `Medication` is a per-hospital catalogue (retire with `active:false`, never delete). `Prescription` items are fixed at creation, only `ACTIVE -> COMPLETED|CANCELLED` (status in the WHERE clause); every medication must be an active catalogue entry of the hospital. `LabOrder` ORDERED -> RESULTED (results entered once, `LabResult.flag` computed by `services/labFlags.ts`, critical results `notify()` the doctor/department) or CANCELLED. Read: ADMIN/DOCTOR/NURSE; write: see `routes/clinical.routes.ts`; mirrored in `Permission` (`clinical:read`, `notes:write`, `rx:write`, `labs:order`, `labs:result`, `medications:manage`). UI: `components/Clinical/*` on the patient page. No allergy/interaction checks and no pharmacy stock yet.
- Pharmacy: `Medication.stockQuantity` is changed ONLY through `services/stock.ts` `changeStock` (one conditional UPDATE — "enough on hand" is in the WHERE — plus a `StockMovement` ledger row, inside a transaction; DB CHECK keeps it >= 0). `POST /pharmacy/receive|adjust` ADMIN (adjust needs a reason), `POST /pharmacy/dispense` ADMIN/DOCTOR/NURSE against an ACTIVE prescription item of an active medication (snapshots `unitPriceMinor` in `Dispensation`); stock is never writable through `/medications`. 409 `INSUFFICIENT_STOCK`. UI: `/pharmacy`, Dispense button on the prescriptions tab.
- Billing (ADMIN only, no dedicated billing/pharmacist role yet): money is an integer in minor units everywhere (`utils/money.ts` assumes 2 decimals; never floats). `Invoice` DRAFT (editable, no number) -> ISSUED (gap-free `INV-000001` from `Hospital.invoiceSeq`, taken in the same transaction as the status change so a refused issue burns no number; frozen) -> PAID (payments sum to total; every guard — DRAFT/ISSUED status, `paid + amount <= total`, `discount <= subtotal` — lives in the UPDATE's WHERE) or VOID (only while nothing is paid; releases dispensed lines for re-billing). `POST /billing/invoices {includeDispensations}` claims unbilled `Dispensation`s (`invoiceLineId` null -> line) so nothing is billed twice. UI: `/billing`, `/billing/:id`. Currency is per invoice (default USD); no tax, refunds or insurance claims yet.
- Exports: `GET /api/exports/:type?format=xlsx|pdf&from&to` (types patients/appointments/vitals: ADMIN+DOCTOR, billing: ADMIN; per-type roles live in `ALLOWED_ROLES` of the controller). Loaders in `services/exports/datasets.ts` are hospital-scoped, skip soft-deleted patients and fetch `cap + 1` rows: more than 10 000 -> 413 `EXPORT_TOO_LARGE`, never a silent truncation. Free text in xlsx cells goes through `sanitizeCell` (formula injection). PDF uses built-in fonts (no Arabic). Every export is audit-logged. UI: `components/Export/ExportMenu` (permissions `export:clinical` / `export:billing`). See `docs/EXPORTS.md`.
- Audit trail: `AuditLog.hospitalId` is copied from the actor by `logActivity` (rows whose actor was already gone before the migration have NULL and are never shown). `GET /api/audit-logs` (+`/actions`) is ADMIN-only, read-only, always scoped by `hospitalIdOf(req)`, filters `action,userId,entityId,from,to` (`to` exclusive), default page size 50; UI route `/audit-logs`.
- Dispatch units keep their position in `lat`/`lng` (floats) and their crew in `Staff.dispatchUnitId` (API: `crew: [{id,name,role}]` out, `crewIds` in).
- Vitals: a critical reading escalates `Patient.status` to CRITICAL (never downgrades, never touches DISCHARGED; emits `patient-status-changed`). Thresholds are per hospital + department (`VitalThresholds.hospitalId`),
  managed with `GET/PUT /api/vitals/thresholds` and `DELETE /api/vitals/thresholds/:id` (PUT/DELETE: DOCTOR/ADMIN); any (department, vital type) without a row uses the built-in adult defaults in `services/vitalThresholds.ts`,
  and a failed threshold lookup is logged as an error and also falls back to the defaults. A reading can therefore never be silently judged "not critical" for lack of configuration.
- Patient codes: `admitPatient` allocates `PT-<n>` under `pg_advisory_xact_lock` inside its transaction (via `$executeRaw`; `$queryRaw` cannot read a `void` result). Lost serializable/deadlock races are recognised with `utils/dbErrors.ts` `isSerializationFailure` (the pg adapter reports `TransactionWriteConflict`/40001, not P2034) and answered 409.
- Beds <-> patients: a bed is OCCUPIED if and only if a patient is assigned to it (`Patient.bedId`). Everything that changes either side goes through `services/bedAssignment.ts` (`claimBed` is an atomic
  AVAILABLE-and-empty -> OCCUPIED update, `releaseBed` frees it) inside a transaction: admit, `PUT /patients/:id` (bedId change, or status DISCHARGED which frees the bed), discharge, `PUT /beds/:id` (patientId assign/unassign;
  a status that contradicts the patient is 400, switching a bed that has a patient away from OCCUPIED is 409) and `DELETE /beds/:id` (409 while it has a patient). Migration `20261030000000_reconcile_beds` repaired old rows.
- Account approval: public signup requires the target hospital's `Hospital.code` (`hospitalCode` in the body, uppercased; unknown code -> 400) and creates `accountStatus: PENDING` (no token/cookie issued); there is no `HOSPITAL_ID` fallback. `protect`, `login` and `socketAuth` answer 403
  ("Account pending admin approval") for PENDING/DISABLED users. Only an ADMIN activates them or invites users with a role
  (`/api/users`: list, invite, `PUT :id/approve`, `:id/reject`, `:id/deactivate`).
- Multi-tenancy: every query is scoped by `hospitalIdOf(req)` (`src/utils/tenant.ts`, = `req.user.hospitalId` loaded from the DB by `protect`).
  Never read `hospitalId` from body/query/params (zod schemas must not declare it). Single records: `findFirst({ where: { id, hospitalId } })` (404 when
  missing) before update/delete; models without their own `hospitalId` (Appointment, Shift, PatientVitals, Report) are scoped through their relation
  (`patient: { hospitalId }`, `staff: { hospitalId }`). Related ids from the client (bed, ward, doctor, patient) must be verified to belong to the same hospital.
  Socket rooms are per hospital via the helpers in `utils/tenant.ts` (`clinicalRoom`, `departmentRoom`, `dispatchRoom`, `unitRoom`).
  `notify()` refuses role/department broadcasts without a `hospitalId`.
- Enums: closed value sets are native Prisma enums (`ShiftType` for `Shift.type`/`User.shift`, `DutyStatus` for `User.status`, `AppointmentType/Status`, `IncidentType/Severity/Status`); validators use `enumValue(Enum, 'label')` (`validators/common.validator.ts`, case/spacing tolerant, so 'Day' -> DAY). `Staff.role` and every `department` stay free-form on purpose. Adding a value = edit the enum + a migration (`ALTER TYPE ... ADD VALUE`) + the frontend option list.
- Time: the server runs in UTC. "Today" ranges, hour grouping and times inside notifications use `Hospital.timezone` (IANA, default UTC; ADMIN sets it with `PUT /settings/hospital`) through `utils/time.ts` (`dayRange`, `hourKey`, `formatLocal`, `hospitalTimezone`). Never use `Date#setHours`/`setDate` or mutate a `Date`; day ranges are half-open `[start, end)` (`gte`/`lt`).
- Reminders: no in-process timer. An external scheduler (Render Cron Job, every minute) calls `POST /api/internal/run-reminders` (`x-reminders-secret` = `REMINDERS_CRON_SECRET`; 404 when unset). `services/reminders.service.ts` claims each reminder via `ReminderLog` (unique key, `createMany skipDuplicates`) before `notify()` — never `findFirst` then `create`. See `docs/NOTIFICATIONS.md`.
- Pagination: list endpoints (beds, staff, shifts, appointments, vitals, notifications, patients) take `?page&limit` (default 100, notifications 20, vitals 50; max 200) via `pageParams()`/`pageInfo()` (`utils/pagination.ts`) and answer `{ success, count, data, pagination: { page, limit, totalCount, totalPages, hasNextPage, hasPrevPage } }` with a deterministic `orderBy` (tie-break on `id`). Screens that need a whole collection use `apiGetAll()` (`frontend/src/services/paginate.ts`).
- Wrap mutating routes in `logActivity('ACTION_NAME')` (audit.middleware) so they land in `AuditLog`.
- Validate request bodies with zod (`src/validators/`), return 400 with a clear message. Do not trust `req.body`.
- Response shape (`utils/apiResponse.ts`): success `{ success: true, data?, message?, pagination? }`; failure `{ success: false, error: { code, message, details? } }`.
  Use `ok()` / `fail(res, status, 'CODE', 'English message')`; `message` is English for developers, the frontend translates `code` (`errors.codes.*` in the locale files).
  `errorEnvelope` (mounted in server.ts) rewrites every legacy failure body (`{ success:false, message }`, `{ error: 'text' }`) into that shape, with a status-based code (VALIDATION_ERROR, UNAUTHORIZED, FORBIDDEN, NOT_FOUND, CONFLICT, RATE_LIMITED, INTERNAL_ERROR) unless the body carries its own `code`
  (e.g. `PATIENT_NOT_FOUND`, `ACCOUNT_PENDING`). New codes: add to `ErrorCode` and to `errors.codes` in `en.json`/`ar.json` when the UI should show a fixed text.
  Login/register/`/auth/me`/2FA return their payload in `data` (`data.user`, `data.token`, `data.twoFactorRequired`); the top-level `user`/`token`/`message`/`code`/`errors` copies are deprecated and will be removed.
- Errors: throw/forward to `errorHandler` where possible; do not leak `error.message` of internal errors to clients.
- Auth: JWT (24h) accepted via `Authorization: Bearer` or httpOnly cookie `token`.
  Passwords hashed with bcryptjs (12 rounds).
- Sockets: `io` is created once in server.ts via `initIO()`; controllers/services use `getIO()` from `utils/socket.ts` (never import from server.ts; tests mock `utils/socket` through `tests/mocks/io.ts`); rooms are `patient-<id>`, `department-<name>`, `dispatch-room`, `unit-<id>`.
  Controllers emit events (vitals, incidents, appointments, dispatch, notifications) to those rooms.
- File uploads: multer memory storage, saved in `Report.fileData` (jpeg/png/pdf, 5MB) and served by `GET /api/patients/reports/:reportId/file`. Older reports may still point to `/uploads/...` on disk. Uploaded files are patient data: never commit them.
- Use the shared Prisma client from `src/config/db.ts`; do not instantiate new clients.
- TypeScript: avoid `any`; type request bodies and use `Prisma` generated types.

## Frontend conventions (React)

- Function components + hooks only. Pages are default or named exports lazy-loaded in `App.tsx`. The URL is the only navigation state: a section is a route inside the `AppLayout` layout route
  (`components/Layout`), and its sidebar entry comes from `configs/navigation.ts` (never a tab state or cookie). Full-page screens (patient detail/edit) are routes outside the layout.
- Server state through React Query; mutations via `hooks/useCrud.ts` (optimistic updates, rollback on error).
- All HTTP goes through `services/api.ts` (`api`, `apiGet/apiPost/apiPut/apiPatch/apiDelete/apiUpload`, all generic over the response type). Never call axios/fetch directly
  in components. Failures reject with `ApiError` (`message` ready to show, `code`, `status`; see `services/normalizeApiError.ts`); read the code with `getErrorCode(err)`.
- Session/RBAC: a 401 on any request calls `notifySessionExpired()` (`services/sessionExpiry.ts`); `AuthProvider` clears the user, toasts once and `PrivateRoute` redirects to `/login`. Role rules live in `configs/permissions.ts` (`ROUTE_ROLES`, `Permission`); use `PrivateRoute allowedRoles`, `useAuthPermissions().can(...)` and keep them in sync with the backend `authorize(...)`.
- Cold starts: `useBackendWarmup` (mounted via `BackendWarmupBanner` in `App.tsx`) polls `GET /api/health` and pings every 10 min while the tab is open.
- Real-time: one `use*Socket` hook per domain; always clean up listeners in the effect cleanup.
- Forms: define fields declaratively in `configs/entityConfigs.ts` and render with `components/Form/*`
  instead of hand-writing new modal forms.
- Styling: Tailwind utility classes (v4, `@tailwindcss/vite`); icons from `lucide-react`; toasts via `sonner`;
  charts via `recharts` only (chart.js was removed).
- Keep bundles small: lazy-load pages and heavy libs; `vite.config.ts` has manualChunks for react/query/charts/icons.
- Accessibility: labels on inputs, aria attributes on icon-only buttons, sufficient colour contrast
  (Lighthouse a11y is ~93; color-contrast is the known failing audit).
- TypeScript strict; type API responses. ESLint forbids `any`, `@ts-ignore`, `console.*` (use `utils/logger`) and ALL inline `eslint-disable` comments (`noInlineConfig`): restructure instead
  (server data -> `useQuery`; reset-on-open -> mount the form per opening; hooks/constants next to a provider -> their own file). Lint must pass before merging.
- Components over ~250 lines get split: state/effects in a hook (`hooks/use*`), pure logic in `utils/` or a `*State.ts`, markup in small components.

## How the two sides connect

- Base URL: `VITE_API_URL` + `/api/<resource>`. Resources: auth, patients (incl. `GET /patients/flow?days=1..30`, daily admissions/discharges in UTC days), beds, wards, vitals, staff,
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
- Frontend: Vitest + Testing Library for units; Playwright (`frontend/e2e`) covers login, the private-route redirect and the patients list/search/detail flow against a mocked API. Extend `mockApi.ts` when adding flows. The mocked suite does NOT exercise the real backend.
  The separate real-backend suite (`frontend/e2e-real`, `npm run test:e2e:real`, CI job `e2e-real` with a `services: postgres` container)
  covers login (seeded user), the private-route redirect and admitting a patient that shows up in the list, and the NotificationBell (badge, mark read, delete, realtime `new-notification`), with no mocks. It also has serial multi-role journeys for the newer modules (`clinical`, `pharmacy-billing` incl. real Excel/PDF downloads, `admin-modules` = wards/users/audit log): sign in per role with `login(page, 'admin'|'doctor'|'nurse')`, create data with `admitPatient(page)`, use unique names (the database is not reset between local runs).
  It uses its own seed (`backend/prisma/seed.e2e.ts`), never `seed.ts`, and refuses a database whose name lacks `e2e`/`test`.
- Integration tests (`backend/tests-int`, CI job `backend-integration`, also checks migration/schema drift) cover what mocks cannot: triggers, CHECK/exclusion/unique constraints, row-lock races (beds, stock, payments, invoice numbers, last admin), tenant isolation of every id-taking route, device ingestion and socket.io room fan-out. Add a case there whenever a rule is enforced by the database or by a conditional UPDATE/transaction.
- Load / contention / abuse-protection scripts: `perf/*.js` (k6, thresholds gate the run; local targets only unless `-e ALLOW_REMOTE=true`; need the API started with the test-only `AUTH_RATE_LIMIT_MAX`/`API_RATE_LIMIT_MAX`, except `rate-limits.js` and `exports.js` which need the defaults). Workflow `load-test.yml` (manual + weekly). See `docs/LOAD_TESTS.md`. Add a script/check there when a path gets a performance or concurrency promise.
- Run `npm test` (backend) and `npm run build && npm run lint` (frontend) before pushing.

## Known issues / priorities (keep this list current)

Open:
- `prisma/migrations` holds the baseline (`00000000000000_baseline`) and `20261020000000_report_file_data` (adds `Report.fileData`); production must run `migrate resolve --applied` for the baseline once (see `docs/MIGRATIONS.md`) before `migrate deploy` is used.
- Legacy uploads under `/uploads` live on Render's ephemeral disk (new ones are stored in the DB). Frontend has unit tests, a mocked-API Playwright suite and a real-backend suite (`npm run test:e2e:real`); broader page coverage is still welcome.
- i18n (en/ar, RTL) covers every page; free text from the API and enum values stay English (see `docs/I18N.md`). PWA (`docs/PWA.md`): the icons are generated placeholders and need real branding. Web Vitals (`docs/WEB_VITALS.md`) report only when `VITE_VITALS_ENDPOINT` is set.
- The credentials once committed in `backend/.env.example` must stay rotated (they remain in git history).

Fixed on main (do not reintroduce): self-signup no longer grants access (PENDING until an ADMIN approves); hospital isolation on every resource (`hospitalId` on Staff, Incident, DispatchUnit, DispatchCall; see migration `20261022000001_hospital_scoping`); `.github/workflows/ci-cd.yml` has no `continue-on-error`, so lint, build and tests are strict in CI; report files are stored in the DB (`Report.fileData`); zod validation covers every resource route via `validate({ params, query, body })` (auth validates in its controller; `GET /wards` has no input); `.env.example` holds placeholders only; `JWT_SECRET` has no fallback;
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
