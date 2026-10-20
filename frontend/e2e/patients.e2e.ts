import { test, expect } from '@playwright/test';
import { mockApi, patients } from './mockApi';

test.describe('patients', () => {
  test.beforeEach(async ({ page }) => {
    await mockApi(page, { loggedIn: true });
  });

  test('lists admitted patients with their status', async ({ page }) => {
    await page.goto('/patients');

    await expect(page.getByRole('heading', { name: 'Patients' })).toBeVisible();
    await expect(page.getByText('Ahmad Khaled')).toBeVisible();
    await expect(page.getByText('Lina Mansour')).toBeVisible();
    await expect(page.getByLabel('Status: CRITICAL')).toBeVisible();
  });

  test('filters the list through the search box', async ({ page }) => {
    await page.goto('/patients');
    await expect(page.getByText('Lina Mansour')).toBeVisible();

    await page.getByLabel('Search patients by name or ID').fill('Ahmad');

    await expect(page.getByText('Ahmad Khaled')).toBeVisible();
    await expect(page.getByText('Lina Mansour')).toBeHidden();
  });

  test('opens a patient record from the list', async ({ page }) => {
    await page.goto('/patients');

    await page.getByLabel('View details for Ahmad Khaled').click();

    await expect(page).toHaveURL(new RegExp(`/patients/${patients[0].id}$`));
    await expect(page.getByText('Ahmad Khaled').first()).toBeVisible();
    await expect(page.getByText('Chest pain').first()).toBeVisible();
  });
});
