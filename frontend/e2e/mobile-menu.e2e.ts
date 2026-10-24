import { test, expect, type Page } from '@playwright/test';
import { mockApi } from './mockApi';

// The sidebar item's name carries the badge count ("Patients 2"), so match on the start of the name.
const patientsItem = (page: Page) => page.locator('aside').getByRole('link', { name: /^Patients/ });

const PHONE = { width: 390, height: 844 };
const DESKTOP = { width: 1280, height: 800 };

test.describe('dashboard menu on a phone', () => {
  test.use({ viewport: PHONE });

  test.beforeEach(async ({ page }) => {
    await mockApi(page, { loggedIn: true });
  });

  test('hides the sidebar behind a menu button and opens a section from it', async ({ page }) => {
    await page.goto('/dashboard');

    const menuButton = page.getByRole('button', { name: 'Open menu' });
    await expect(menuButton).toBeVisible();
    await expect(patientsItem(page)).toBeHidden();

    await menuButton.click();
    await expect(page.getByRole('button', { name: 'Close menu' })).toHaveAttribute('aria-expanded', 'true');
    await patientsItem(page).click();

    // The drawer closes and the section is shown at the full phone width.
    await expect(page.getByRole('button', { name: 'Open menu' })).toBeVisible();
    await expect(patientsItem(page)).toBeHidden();
    await expect(page.getByRole('main')).toHaveAttribute('aria-label', /Patients/);
    const main = await page.getByRole('main').boundingBox();
    expect(main?.width).toBeGreaterThan(PHONE.width - 1);
  });

  test('closes the menu with Escape', async ({ page }) => {
    await page.goto('/dashboard');
    await page.getByRole('button', { name: 'Open menu' }).click();
    await expect(patientsItem(page)).toBeVisible();

    await page.keyboard.press('Escape');

    await expect(patientsItem(page)).toBeHidden();
  });
});

test.describe('dashboard menu on a desktop', () => {
  test.use({ viewport: DESKTOP });

  test('keeps the sidebar visible and shows no menu button', async ({ page }) => {
    await mockApi(page, { loggedIn: true });
    await page.goto('/dashboard');

    await expect(patientsItem(page)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Open menu' })).toBeHidden();
  });
});
