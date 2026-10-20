import { expect, type Page } from '@playwright/test';

// Created by backend/prisma/seed.e2e.ts (throwaway database only).
export const SEED_ADMIN = { email: 'e2e.admin@hospilink.test', password: 'E2e-Password-123!' };

// Matches a URL ending in /dashboard ("http://localhost:4173/dashboard"), not "/login".
const DASHBOARD_URL = /\/dashboard$/;

type Cookies = Awaited<ReturnType<ReturnType<Page['context']>['cookies']>>;

// The auth endpoints are rate limited (20 requests per 15 minutes, backend/src/server.ts) and a login plus
// the /auth/me calls of every page load add up quickly. The suite runs in one worker, so the session cookie
// from the first sign-in is reused instead of signing in again for every test.
let sessionCookies: Cookies | null = null;

/** Signs in through the login form (the real flow). Use it only where the sign-in itself is under test. */
export async function loginViaUi(page: Page): Promise<void> {
  await page.goto('/login');
  await page.getByPlaceholder('doctor@hospital.com').fill(SEED_ADMIN.email);
  await page.getByPlaceholder('••••••••').fill(SEED_ADMIN.password);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page).toHaveURL(DASHBOARD_URL);
  sessionCookies = await page.context().cookies();
}

/** Gets a signed-in page: reuses the cached session when there is one, otherwise signs in through the UI. */
export async function login(page: Page): Promise<void> {
  if (!sessionCookies) {
    await loginViaUi(page);
    return;
  }
  await page.context().addCookies(sessionCookies);
  await page.goto('/dashboard');
  await expect(page).toHaveURL(DASHBOARD_URL);
}
