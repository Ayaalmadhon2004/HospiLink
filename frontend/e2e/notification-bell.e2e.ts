import { test, expect } from '@playwright/test';
import { mockApi } from './mockApi';

const sizes = [
  { name: 'phone', viewport: { width: 390, height: 844 } },
  { name: 'desktop', viewport: { width: 1280, height: 800 } },
];

for (const { name, viewport } of sizes) {
  test.describe(`notification bell on a ${name}`, () => {
    test.use({ viewport });

    test('shows the unread count and opens the list inside the screen', async ({ page }) => {
      await mockApi(page, { loggedIn: true });
      await page.goto('/dashboard');

      const bell = page.getByRole('button', { name: 'Notifications' });
      await expect(bell).toBeVisible();
      await expect(bell).toContainText('1');

      await bell.click();
      const item = page.getByText('Bed 4 freed');
      await expect(item).toBeVisible();

      const box = await item.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
    });
  });
}
