import { test, expect, type Page } from '@playwright/test';
import { login } from './helpers';

// Matches the seeded notification (backend/prisma/seed.e2e.ts).
const SEEDED_TITLE = 'Seeded unread notification';
const SEEDED_MESSAGE = 'Seeded message for the bell';
const BELL = { name: 'Notifications', exact: true } as const;
const API_URL = 'http://localhost:5000/api';
// Time for the bell's socket.io client to connect and join its user room; events are not replayed.
const SOCKET_SETTLE_MS = 1500;
const HTTP_CREATED = 201;

interface StoredNotifications {
  unreadCount: number;
  data: { title: string }[];
}

/** Reads the signed-in user's notifications straight from the real API (the page's session cookie). */
async function fetchNotifications(page: Page): Promise<StoredNotifications> {
  const res = await page.request.get(`${API_URL}/notifications`);
  expect(res.ok()).toBe(true);
  return (await res.json()) as StoredNotifications;
}

test.describe('notification bell (real backend + database + socket.io)', () => {
  test('seeded unread notification: badge, mark read, delete', async ({ page }) => {
    await login(page);

    const bell = page.getByRole('button', BELL);
    await expect(bell).toContainText('1');

    await bell.click();
    const item = page.getByRole('button', { name: SEEDED_TITLE }).first();
    await expect(item).toBeVisible();
    await expect(page.getByText(SEEDED_MESSAGE)).toBeVisible();

    // Mark as read by clicking it; the badge goes away and the change is stored in PostgreSQL.
    await item.click();
    await expect(bell).not.toContainText('1');
    expect((await fetchNotifications(page)).unreadCount).toBe(0);

    // Still listed (read), then deleted for good.
    await bell.click();
    await expect(page.getByText(SEEDED_TITLE)).toBeVisible();
    await page.getByRole('button', { name: `Delete notification ${SEEDED_TITLE}`, exact: true }).click();
    await expect(page.getByText(SEEDED_TITLE)).toBeHidden();
    expect((await fetchNotifications(page)).data.map((n) => n.title)).not.toContain(SEEDED_TITLE);
  });

  test('a notification created through the API reaches the bell over socket.io without a reload', async ({ page }) => {
    const title = `E2E broadcast ${Date.now()}`;

    await login(page);
    const bell = page.getByRole('button', BELL);
    await bell.click();
    await page.waitForTimeout(SOCKET_SETTLE_MS);

    // An admin broadcast is a SYSTEM notification delivered to every user of the hospital (the admin included)
    // through the user-<id> room ('new-notification'). Incident events exclude the acting user on purpose.
    const res = await page.request.post(`${API_URL}/notifications/broadcast`, {
      data: { title, message: 'Broadcast sent from the real-backend E2E' },
    });
    expect(res.status()).toBe(HTTP_CREATED);

    await expect(page.getByRole('button', { name: title }).first()).toBeVisible();
    await expect(bell).toContainText('1');

    // Persisted too, still unread.
    const stored = await fetchNotifications(page);
    expect(stored.unreadCount).toBe(1);
    expect(stored.data[0].title).toBe(title);
  });
});
