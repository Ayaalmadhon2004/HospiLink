import { test, expect } from '@playwright/test';
import { mockApi, doctor } from './mockApi';

test.describe('authentication', () => {
  test('redirects an anonymous visitor from a private page to login', async ({ page }) => {
    await mockApi(page, { loggedIn: false });

    await page.goto('/patients');

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { name: 'Welcome Back' })).toBeVisible();
  });

  test('shows an error for wrong credentials and stays on login', async ({ page }) => {
    await mockApi(page);
    await page.goto('/login');

    await page.getByPlaceholder('doctor@hospital.com').fill('sara@hospital.com');
    await page.getByPlaceholder('••••••••').fill('wrong-password');
    await page.getByRole('button', { name: 'Sign In' }).click();

    await expect(page.getByText('Invalid credentials')).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });

  test('signs in with valid credentials and lands on the dashboard', async ({ page }) => {
    await mockApi(page);
    await page.goto('/login');

    await page.getByPlaceholder('doctor@hospital.com').fill(doctor.email);
    await page.getByPlaceholder('••••••••').fill('correct-horse');
    await page.getByRole('button', { name: 'Sign In' }).click();

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByText('Loading your session...')).toBeHidden();
  });

  test('keeps the session across a reload on a private page', async ({ page }) => {
    await mockApi(page, { loggedIn: true });

    await page.goto('/patients');
    await page.reload();

    await expect(page).toHaveURL(/\/patients$/);
    await expect(page.getByRole('heading', { name: 'Patients' })).toBeVisible();
  });
});
