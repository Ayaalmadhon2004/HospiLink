import { test, expect } from '@playwright/test';
import { login, SEED_ADMIN } from './helpers';

// URL endings: "http://localhost:4173/login" matches LOGIN_URL, ".../patients" does not.
const LOGIN_URL = /\/login$/;
// "http://localhost:4173/patients" matches, ".../patients/abc" does not.
const PATIENTS_URL = /\/patients$/;

test.describe('authentication (real backend)', () => {
  test('redirects an anonymous visitor from a private page to login', async ({ page }) => {
    await page.goto('/patients');
    await expect(page).toHaveURL(LOGIN_URL);
  });

  test('rejects a wrong password', async ({ page }) => {
    await page.goto('/login');
    await page.getByPlaceholder('doctor@hospital.com').fill(SEED_ADMIN.email);
    await page.getByPlaceholder('••••••••').fill('definitely-wrong');
    await page.getByRole('button', { name: 'Sign In' }).click();

    await expect(page).toHaveURL(LOGIN_URL);
  });

  test('signs in with the seeded user and keeps the session across a reload', async ({ page }) => {
    await login(page);

    await page.goto('/patients');
    await page.reload();
    await expect(page).toHaveURL(PATIENTS_URL);
    await expect(page.getByRole('heading', { name: 'Patients' })).toBeVisible();
  });
});
