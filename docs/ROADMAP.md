# Remaining roadmap

Status of the five areas requested. "Done" items ship in this branch; the rest are sized and ordered. Per `CLAUDE.md` each line below should be its own branch/PR from `main`.

## Done in this branch
- Vitals ingestion layer (HL7 v2 / FHIR / JSON, MQTT via bridge), `DeviceKey` management → `docs/VITALS_INTEGRATION.md`
- Backup scripts, nightly workflow, restore drill, retention policy → `docs/BACKUP_AND_RETENTION.md`
- Secret scan workflow over full history (`.github/workflows/secret-scan.yml`)
- Wards CRUD (API + `WardsPanel`) and the ADMIN audit-log page (`AuditLog.hospitalId` migration + `/audit-logs`)

## 1. Product modules (order = value / risk)
| # | PR | Scope | Size |
|---|---|---|---|
| 1 | ~~`feat/wards-crud`~~ done | `POST/PUT/DELETE /wards` (ADMIN, `Restrict` while beds exist → 409), `ward.validator`, tests; the beds API already has full CRUD, add Ward + Bed management screens in `pages/` using `entityConfigs` + `useCrud` | S |
| 2 | ~~`feat/audit-log-admin`~~ done (CSV export still open) | `GET /api/audit-logs?page&limit&action&userId&from&to` (ADMIN, scoped through `user.hospitalId`; `AuditLog` has no `hospitalId`, so add it + backfill migration first, otherwise this is a cross-tenant leak), `AuditLogPage` with filters + CSV export; index `AuditLog(createdAt)` | M |
| 3 | ~~`feat/user-management`~~ done (invite-user form still open) | `PUT /users/:id/role` (ADMIN, same hospital; refuse demoting the last ADMIN and self-demotion; revoke sessions via `passwordChangedAt`-style bump), `PUT :id/activate` (counterpart of `deactivate`); frontend Users page (list/approve/reject/role/activate) — the approve/reject/deactivate endpoints already exist | M |
| 4 | `feat/clinical-records` | Models `ClinicalNote`, `Prescription`(+`PrescriptionItem`), `Medication` (catalogue), `LabOrder`/`LabResult` — all with `hospitalId`, `patientId`, `authorId`→`Staff`, soft-delete like `Patient`; notes append-only (amend = new version). Roles: DOCTOR write, NURSE read/administer, tests per path. Needs a clinical sign-off on fields before migrating | L |
| 5 | `feat/pharmacy-billing` | Pharmacy: stock (`MedicationStock` per hospital, decrement in the same transaction as dispensing a prescription item, never below 0). Billing: `Invoice`, `InvoiceLine`, `Payment`; money as integer minor units (no floats), status DRAFT→ISSUED→PAID/VOID, immutable once ISSUED (VOID + reissue). Add a `PHARMACIST`/`BILLING` role only after the access matrix is agreed | L |
| 6 | `feat/exports` | Reports: server-side `GET /api/reports/export?type=patients|appointments|billing|vitals&format=xlsx|pdf&from&to` (ADMIN/DOCTOR, streamed; `exceljs` for xlsx, `pdfkit` for pdf, hard row cap + audit-logged, tenant-scoped, CSV-injection guard: prefix `= + - @` cells with `'`). Frontend: export menu on list pages | M |

## 2. Real-database tests (CI job `backend-integration`)
- Add `backend/tests-int/` with its own `jest.int.config.ts`, no Prisma mock, a `services: postgres:17` container, `prisma migrate deploy`, and `TRUNCATE … CASCADE` between tests. Refuse a database whose name lacks `test`/`e2e` (same guard as `seed.e2e.ts`).
- First cases (each maps to a rule in `CLAUDE.md` that mocks cannot prove):
  1. two concurrent `claimBed` calls for one bed → exactly one succeeds;
  2. overlapping appointments inserted concurrently → one hits the exclusion constraint;
  3. `DELETE` on `Patient` raises `restrict_violation` (the trigger);
  4. `ReminderLog` `createMany skipDuplicates` run twice in parallel → one notification;
  5. tenant isolation: user of hospital A gets 404 for hospital B ids on every resource (table-driven over the routes);
  6. device ingest end-to-end: create key → POST HL7 → row in `PatientVitals`, patient becomes CRITICAL.
- Socket E2E (in the same suite, `socket.io-client` against the booted `server`): connect with cookie/JWT → expect `new-vital` in `patient-<id>`, `patient-status-changed` in the clinical room, no event leaking to another hospital's client, connection refused without a token.
- Playwright real suite additions (`frontend/e2e-real`): admit→bed→discharge flow, vitals entry → critical alert toast, role guard per `ROUTE_ROLES`.
- Load: `k6` script `perf/vitals-ingest.js` (50 devices × 1 reading/s, p95 < 300 ms, error rate < 1%) and `perf/api-read.js` against a staging DB; run manually / nightly, not on PRs.
- Security: `npm audit --omit=dev` + `gitleaks` + OWASP ZAP baseline against staging (`zaproxy/action-baseline`) in a scheduled workflow; ESLint `security` plugin on the backend.

## 3. Secrets and git history (manual — cannot be done from code)
The credentials from `52ba5af` ("Initial clean commit") and `d74a65d` are still in history. Checklist for the repo owner:
1. Neon: reset the password of every role that appeared in `backend/.env.example` history (or delete the role), regenerate `DATABASE_URL` on Render, confirm the old string fails to connect.
2. Rotate `JWT_SECRET` (invalidates all sessions — acceptable) and any SMTP/Sentry/other keys that ever appeared there; issue a fresh `TWO_FACTOR_ENC_KEY` **only after** re-encrypting existing TOTP secrets (rotating it blindly locks every 2FA user out).
3. Run `secret-scan` (this branch adds it). Expect findings for the old commits; after step 1–2, record each fingerprint in `.gitleaksignore` with a comment `# rotated <date>` so CI is green and the audit trail stays.
4. Optional: purge history with `git filter-repo --replace-text` + force-push — only after rotation, coordinate with all clones; rotation, not purging, is what removes the risk.
5. Turn on GitHub secret scanning + push protection in repo settings.

## 4. PWA, Web Vitals, i18n
- PWA: replace `frontend/public/icons/*` with real branding (192/512 PNG + maskable 512 + `apple-touch-icon` 180); regenerate from one SVG with `npx pwa-asset-generator`; verify in Lighthouse "installable".
- Web Vitals: `VITE_VITALS_ENDPOINT` unset already means "report nothing"; add `navigator.sendBeacon` with `fetch(..., {keepalive:true})` fallback, sample rate `VITE_VITALS_SAMPLE` (default 0.1), and a backend `POST /api/vitals-report` (public, tiny body cap, rate-limited, no PII) or point it at the analytics provider.
- i18n: (a) enum labels — one `enums.<Enum>.<VALUE>` namespace in `en.json`/`ar.json` and a `useEnumLabel('PatientStatus')` hook replacing raw `{status}` renders; add a test that fails when an enum value from `schema.prisma` has no key. (b) Patient names / free text stay as entered (do not translate PII); instead store optional `nameAr` only if the hospital wants bilingual records. (c) API messages: every `fail()` code needs an `errors.codes.*` entry — add a test that diffs `ErrorCode` against the locale files. (d) new modules above must ship with keys in both files.
