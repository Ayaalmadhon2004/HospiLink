import { test, expect } from '@playwright/test';
import { login } from './helpers';

// PHARMACIST and BILLING against the real backend: each lands on its own module, sees only that module, and is turned away elsewhere.
test.describe.configure({ mode: 'serial' });

test.describe('pharmacist and billing roles (real backend + database)', () => {
  test('pharmacist lands on the pharmacy with the dispensing queue and no clinical navigation', async ({ page }) => {
    await login(page, 'pharmacist');
    await expect(page.getByRole('heading', { name: 'Pharmacy', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Waiting to be dispensed' })).toBeVisible();
    const nav = page.getByRole('navigation');
    await expect(nav.getByRole('link', { name: 'Pharmacy' })).toBeVisible();
    for (const name of ['Patients', 'Billing', 'Vitals Monitor', 'Users']) await expect(nav.getByRole('link', { name })).toHaveCount(0);

    await page.goto('/patients');
    await expect(page.getByRole('alert')).toContainText(/permission|not allowed|access/i);
    await page.goto('/billing');
    await expect(page.getByRole('alert')).toBeVisible();
  });

  test('billing clerk lands on billing and drafts an invoice for a patient found through the minimal lookup', async ({ page }) => {
    await login(page, 'billing');
    await expect(page.getByRole('button', { name: 'New invoice' })).toBeVisible();
    await expect(page.getByRole('navigation').getByRole('link', { name: 'Pharmacy' })).toHaveCount(0);

    await page.getByRole('button', { name: 'New invoice' }).click();
    await page.getByRole('combobox', { name: /patient/i }).fill('Seeded Patient One');
    await page.getByRole('option', { name: /Seeded Patient One/ }).click();
    await page.getByRole('button', { name: 'Create draft' }).click();
    await expect(page).toHaveURL(/\/billing\/[0-9a-f-]{36}$/);

    await page.goto('/pharmacy');
    await expect(page.getByRole('alert')).toBeVisible();
  });
});
