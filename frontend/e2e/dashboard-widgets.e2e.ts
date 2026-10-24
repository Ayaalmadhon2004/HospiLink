import { test, expect } from '@playwright/test';
import { mockApi } from './mockApi';

const PHONE = { width: 390, height: 844 };

test.describe('dashboard widgets', () => {
  test.use({ viewport: PHONE });

  test('overview shows the patient flow chart', async ({ page }) => {
    await mockApi(page, { loggedIn: true });
    await page.goto('/dashboard');
    const section = page.getByRole('region', { name: 'Patient flow over the last 7 days' });
    await section.scrollIntoViewIfNeeded();
    await expect(section.getByText('Patient Flow')).toBeVisible();
  });

  test('staff tab shows the shift timeline and staff cards on a phone', async ({ page }) => {
    await mockApi(page, { loggedIn: true });
    await page.goto('/dashboard');
    await page.getByRole('button', { name: 'Open menu' }).click();
    await page.getByRole('link', { name: 'Staff & Shifts' }).first().click();
    await expect(page.getByRole('region', { name: "Today's shift timeline" }).getByText('Cardiology')).toBeVisible();
    await expect(page.getByRole('article', { name: 'Staff card for Sara Ali, Nurse' })).toBeVisible();
  });
});
