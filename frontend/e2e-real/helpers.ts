import { expect, type Page } from '@playwright/test';

// Created by backend/prisma/seed.e2e.ts (throwaway database only).
export const SEED_ADMIN = { email: 'e2e.admin@hospilink.test', password: 'E2e-Password-123!' };

// Matches a URL ending in /dashboard ("http://localhost:4173/dashboard"), not "/login".
const DASHBOARD_URL = /\/dashboard$/;

export async function login(page: Page): Promise<void> {
  await page.goto('/login');
  await page.getByPlaceholder('doctor@hospital.com').fill(SEED_ADMIN.email);
  await page.getByPlaceholder('••••••••').fill(SEED_ADMIN.password);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page).toHaveURL(DASHBOARD_URL);
}
