import { test, expect } from '@playwright/test';
import { login } from './helpers';

// Patient detail URL: ".../patients/3f2a-91" matches, ".../patients" does not.
const PATIENT_DETAIL_URL = /\/patients\/[\w-]+$/;

test.describe('patients (real backend + database)', () => {
  test('lists seeded patients', async ({ page }) => {
    await login(page);
    await page.goto('/patients');

    await expect(page.getByRole('heading', { name: 'Patients' })).toBeVisible();
    await expect(page.getByText('Seeded Patient One')).toBeVisible();
  });

  test('admits a new patient and finds it in the list after a reload', async ({ page }) => {
    // Unique per run so the test also passes on a database that was not reset.
    const name = `E2E Patient ${Date.now()}`;

    await login(page);
    await page.goto('/patients');
    await page.getByRole('button', { name: 'Admit new patient' }).click();

    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Full Name').fill(name);
    await dialog.getByLabel('Age').fill('37');
    await dialog.getByLabel('Gender').selectOption('FEMALE');
    await dialog.getByLabel('Department').selectOption('General');
    await dialog.getByLabel('Diagnosis').fill('Routine observation');
    await dialog.getByRole('button', { name: 'Admit Patient' }).click();

    // Modal closes and the list refreshes.
    await expect(dialog).toBeHidden();
    await page.getByLabel('Search patients by name or ID').fill(name);
    await expect(page.getByText(name)).toBeVisible();

    // Persisted in PostgreSQL, not just in the client cache.
    await page.reload();
    await page.getByLabel('Search patients by name or ID').fill(name);
    await expect(page.getByText(name)).toBeVisible();
    await page.getByLabel(`View details for ${name}`).click();
    await expect(page).toHaveURL(PATIENT_DETAIL_URL);
    await expect(page.getByText('Routine observation').first()).toBeVisible();
  });
});
