import { defineConfig, devices } from '@playwright/test';

// Real-backend E2E: Chromium -> Vite preview build -> real Express API -> throwaway PostgreSQL.
// Nothing is mocked. The mocked-API suite lives in ./e2e (playwright.config.ts) and is untouched.
//
// Required env:
//   E2E_DATABASE_URL  connection string of a THROWAWAY database whose name contains "e2e" or "test".
//                     The suite runs `prisma migrate deploy` + the seed against it. Never point it at
//                     a real database (the guard below refuses names without e2e/test).
// Optional env:
//   E2E_JWT_SECRET    defaults to a throwaway value (never use a real secret).
//
// Origins: the browser must use `localhost:4173` because it is in the backend CORS allowlist
// (CORS_ORIGINS below, validated by backend/src/config/env.ts). The API runs on localhost:5000 (same site,
// different port), so the Secure/SameSite=None httpOnly auth cookie works without changing CORS.
const WEB_PORT = 4173;
const API_PORT = 5000;
const WEB_URL = `http://localhost:${WEB_PORT}`;
const API_URL = `http://localhost:${API_PORT}`;
const SERVER_START_TIMEOUT_MS = 180_000;

const databaseUrl = process.env.E2E_DATABASE_URL;
if (!databaseUrl) {
  throw new Error(
    'E2E_DATABASE_URL is not set. Point it at a throwaway PostgreSQL database (see docs/E2E_REAL.md).',
  );
}
const dbName = decodeURIComponent(new URL(databaseUrl).pathname.slice(1));
// Accepts names containing e2e or test in any case: "hospilink_e2e" matches, "hospilink" does not.
const THROWAWAY_DB_NAME = /(e2e|test)/i;
if (!THROWAWAY_DB_NAME.test(dbName)) {
  throw new Error(
    `Refusing to run: database "${dbName}" does not look throwaway (its name must contain "e2e" or "test").`,
  );
}

const backendEnv: Record<string, string> = {
  DATABASE_URL: databaseUrl,
  JWT_SECRET: process.env.E2E_JWT_SECRET ?? 'e2e-throwaway-jwt-secret-not-for-production',
  PORT: String(API_PORT),
  CORS_ORIGINS: WEB_URL,
  // Test-only: one browser session calls /api/auth/me on every page load, which would exhaust the production limits
  // (20 auth requests / 15 min, 200 API requests / min). Production keeps the defaults.
  AUTH_RATE_LIMIT_MAX: '2000',
  API_RATE_LIMIT_MAX: '5000',
  // Keep the unrelated error reporter off in tests.
  SENTRY_DSN: '',
};

export default defineConfig({
  testDir: './e2e-real',
  testMatch: '**/*.e2e.ts',
  // Tests share one database and depend on the seeded user, so run them one at a time.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  outputDir: 'test-results-real',
  use: {
    baseURL: WEB_URL,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      // Apply migrations, seed deterministic data, then start the real API.
      command: 'npx prisma generate && npx prisma migrate deploy && npx tsx prisma/seed.e2e.ts && npx tsx src/server.ts',
      cwd: '../backend',
      env: backendEnv,
      url: `${API_URL}/api/health`,
      reuseExistingServer: false,
      timeout: SERVER_START_TIMEOUT_MS,
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      command: `VITE_API_URL=${API_URL}/api npx vite build --outDir dist-e2e-real && npx vite preview --outDir dist-e2e-real --host localhost --port ${WEB_PORT} --strictPort`,
      url: WEB_URL,
      reuseExistingServer: false,
      timeout: SERVER_START_TIMEOUT_MS,
    },
  ],
});
