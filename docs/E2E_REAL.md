# Real-backend E2E tests

`frontend/e2e-real/*.e2e.ts` drive Chromium through the built frontend against the **real Express API and a real
PostgreSQL database**. Nothing is mocked. They complement the mocked-API suite in `frontend/e2e` (unchanged).

Covered: sign in with a seeded user (and wrong-password / private-route redirect), session kept across a reload,
seeded patients listed, admitting a patient through the UI and finding it in the list after a reload.
Report upload (`reports.e2e.ts`): uploading a PDF through the UI, finding it listed after a reload, and fetching it back with the
same bytes; the 5 MB limit is enforced by the UI and by the API, and a non PDF/JPEG/PNG file is refused by the API.

Notification bell (`notification-bell.e2e.ts`): the seeded unread notification shows a badge of 1, opening the dropdown lists it,
clicking it marks it read (badge gone, stored in the DB) and deleting it removes it for good; creating an incident through the real API
makes a new notification appear in the bell over socket.io (`new-notification` to the `user-<id>` room) without a reload.

The auth endpoints are rate limited (20 requests per 15 minutes), so `login()` in `e2e-real/helpers.ts` signs in through the form
once and reuses that session cookie for the rest of the run; use `loginViaUi()` only where the sign-in itself is under test.

## How it works

`frontend/playwright.real.config.ts` starts two servers and tears them down afterwards:

1. Backend (cwd `backend/`): `prisma generate`, `prisma migrate deploy`, `tsx prisma/seed.e2e.ts`, then `tsx src/server.ts` on port 5000.
2. Frontend: `vite build` with `VITE_API_URL=http://localhost:5000/api`, then `vite preview` on `localhost:4173`.

Origins and cookies: the browser uses `http://localhost:4173`, which is already in the backend CORS allowlist
(`DEFAULT_ORIGINS`), so CORS is not changed or relaxed. `localhost:4173` and `localhost:5000` are the same site, and Chromium
accepts the `Secure; SameSite=None; HttpOnly` auth cookie on `localhost`, so the real login cookie flow is exercised.

Data: `backend/prisma/seed.e2e.ts` (not `seed.ts`) creates one hospital, the admin `e2e.admin@hospilink.test` , two patients
(`E2E-0001`, `E2E-0002`) and one unread notification for the admin (fixed id, "Seeded unread notification"). It is idempotent but the suite adds a patient per run, so recreate the database between local runs.

## Run locally

You need Node 20+, any reachable PostgreSQL (no docker required) and the Chromium browser for Playwright.

```bash
# 1. a throwaway database; its NAME MUST contain "e2e" or "test" (the config refuses anything else)
createdb hospilink_e2e            # or: psql -c 'CREATE DATABASE hospilink_e2e'

# 2. install
(cd backend && npm ci)
cd frontend && npm ci && npx playwright install chromium

# 3. run (fills in a throwaway JWT secret; override with E2E_JWT_SECRET if you like)
E2E_DATABASE_URL='postgresql://postgres:postgres@localhost:5432/hospilink_e2e' npm run test:e2e:real
```

Recreate the database for a clean run: `dropdb hospilink_e2e && createdb hospilink_e2e`.

Ports 5000 and 4173 must be free (the config never reuses an already-running server, so it cannot test the wrong build).
`E2E_DATABASE_URL` is deliberately not `DATABASE_URL`, so a `backend/.env` pointing at a real database can never be used by accident.

## CI

The `e2e-real` job in `.github/workflows/ci-cd.yml` runs this suite with a `services: postgres:16` container, a fresh database
per run and a throwaway `E2E_JWT_SECRET` set in the job env (no repository secrets). Playwright traces are uploaded on failure.

## Adding tests

Put new files in `frontend/e2e-real/` as `*.e2e.ts`, log in with `login(page)` from `helpers.ts`, use unique names
(e.g. a timestamp suffix) for data you create, and add any extra deterministic data to `backend/prisma/seed.e2e.ts`.
