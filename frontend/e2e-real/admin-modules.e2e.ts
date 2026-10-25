import { test, expect, type Page } from '@playwright/test';
import { login, API_URL } from './helpers';

test.describe.configure({ mode: 'serial' });

const RUN = Date.now();
const dialog = (page: Page) => page.getByRole('dialog').last();

test.describe('wards (real backend + database)', () => {
  const WARD = `E2E Ward ${RUN}`;
  const RENAMED = `E2E Ward renamed ${RUN}`;

  test('admin adds, renames and deletes a ward; the list survives a reload', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/beds');
    await page.getByRole('button', { name: 'Add Ward' }).click();
    await dialog(page).getByLabel('Ward name').fill(WARD);
    await dialog(page).getByLabel('Floor').fill('3');
    await dialog(page).getByRole('button', { name: 'Add Ward' }).click();
    await expect(dialog(page)).toBeHidden();
    const card = page.getByRole('listitem').filter({ hasText: WARD });
    await expect(card).toContainText('Floor 3 · 0 beds');

    await page.reload();
    await expect(page.getByRole('listitem').filter({ hasText: WARD })).toBeVisible();

    await page.getByRole('button', { name: `Edit ward ${WARD}` }).click();
    await expect(dialog(page).getByLabel('Ward name')).toHaveValue(WARD);
    await dialog(page).getByLabel('Ward name').fill(RENAMED);
    await dialog(page).getByLabel('Floor').fill(''); // empty clears the floor
    await dialog(page).getByRole('button', { name: 'Save changes' }).click();
    await expect(dialog(page)).toBeHidden();
    const renamed = page.getByRole('listitem').filter({ hasText: RENAMED });
    await expect(renamed).toContainText('0 beds');
    await expect(renamed).not.toContainText('Floor');

    await page.getByRole('button', { name: `Delete ward ${RENAMED}` }).click();
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(page.getByRole('listitem').filter({ hasText: RENAMED })).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole('listitem').filter({ hasText: RENAMED })).toHaveCount(0);
  });

  test('a duplicate name is refused by the server; a ward that has beds cannot be deleted', async ({ page }) => {
    await login(page, 'admin');
    const name = `E2E Ward bedded ${RUN}`;
    const created = await page.request.post(`${API_URL}/wards`, { data: { name } });
    expect(created.status()).toBe(201);
    const ward = ((await created.json()) as { data: { id: string } }).data;
    expect((await page.request.post(`${API_URL}/wards`, { data: { name: name.toUpperCase() } })).status()).toBe(409);
    expect((await page.request.post(`${API_URL}/beds`, { data: { bedNumber: `E2E-${RUN}`, wardId: ward.id } })).status()).toBe(201);

    await page.goto('/beds');
    const card = page.getByRole('listitem').filter({ hasText: name });
    await expect(card).toContainText('1 bed');
    await expect(card.getByRole('button', { name: `Delete ward ${name}` })).toBeDisabled();
    // ...and the server agrees even if the button were bypassed.
    const res = await page.request.delete(`${API_URL}/wards/${ward.id}`);
    expect(res.status()).toBe(409);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe('WARD_HAS_BEDS');
  });

  test('doctors and nurses see the wards but have no management buttons', async ({ page }) => {
    for (const role of ['doctor', 'nurse'] as const) {
      await login(page, role);
      await page.goto('/beds');
      await expect(page.getByRole('heading', { name: 'Wards', exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Add Ward' })).toHaveCount(0);
      await expect(page.getByRole('button', { name: /^Edit ward/ })).toHaveCount(0);
    }
  });
});

test.describe('user management and audit log (real backend + database)', () => {
  const NAME = `E2E Newcomer ${RUN}`;
  const row = (page: Page) => page.getByRole('row', { name: new RegExp(NAME) });
  const filter = (page: Page, name: RegExp | string) => page.getByRole('group', { name: 'Filter by account status' }).getByRole('button', { name });

  test('a public sign-up waits as PENDING until an admin approves it with a role', async ({ page, request }) => {
    const signup = await request.post(`${API_URL}/auth/signup`, {
      data: { name: NAME, email: `newcomer.${RUN}@hospilink.test`, password: 'E2e-Password-123!', department: 'General', shift: 'DAY', hospitalCode: 'E2E-TEST' },
    });
    expect(signup.status()).toBe(201);

    await login(page, 'admin');
    await page.goto('/users');
    await filter(page, /^Pending/).click();
    await expect(row(page)).toContainText('Pending');
    await page.getByLabel(`Role for ${NAME}`).selectOption('NURSE');
    await row(page).getByRole('button', { name: 'Approve' }).click();
    await expect(row(page)).toHaveCount(0); // left the pending view

    await filter(page, 'Active').click();
    await expect(row(page)).toContainText('Active');
    await expect(page.getByLabel(`Role for ${NAME}`)).toHaveValue('NURSE');
  });

  test('changing the role asks for confirmation, then deactivate and activate move the account between states', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/users');
    await filter(page, 'Active').click();

    await page.getByLabel(`Role for ${NAME}`).selectOption('DOCTOR');
    await expect(page.getByText(/signed out everywhere/)).toBeVisible();
    await page.getByRole('button', { name: 'Confirm' }).click();
    await expect(page.getByLabel(`Role for ${NAME}`)).toHaveValue('DOCTOR');

    await row(page).getByRole('button', { name: 'Deactivate' }).click();
    await expect(row(page)).toHaveCount(0);
    await filter(page, 'Deactivated').click();
    await expect(row(page)).toContainText('Deactivated');
    await row(page).getByRole('button', { name: 'Activate' }).click(); // re-activates with the role shown in the row
    await expect(row(page)).toHaveCount(0);
    await filter(page, 'Active').click();
    await expect(row(page)).toContainText('Active');
    await expect(page.getByLabel(`Role for ${NAME}`)).toHaveValue('DOCTOR');
  });

  test('an admin cannot change their own role or deactivate themselves from the page', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/users');
    const self = page.getByRole('row', { name: /E2E Admin/ });
    await expect(self).toContainText('(you)');
    await expect(page.getByLabel('Role for E2E Admin')).toBeDisabled();
    await expect(self.getByRole('button', { name: 'Deactivate' })).toHaveCount(0);
  });

  test('every one of those actions is in the audit log, and the action filter narrows it', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/audit-logs');
    const codes = page.locator('tbody code');
    await expect(codes.filter({ hasText: 'APPROVE_USER' }).first()).toBeVisible();
    await expect(codes.filter({ hasText: 'DEACTIVATE_USER' }).first()).toBeVisible();
    await expect(codes.filter({ hasText: 'ACTIVATE_USER' }).first()).toBeVisible();
    await expect(codes.filter({ hasText: 'CHANGE_USER_ROLE' }).first()).toBeVisible();

    await page.getByLabel('Action').selectOption('CHANGE_USER_ROLE');
    await expect(codes.first()).toHaveText('CHANGE_USER_ROLE');
    const texts = await codes.allTextContents();
    expect(texts.length).toBeGreaterThan(0);
    expect(new Set(texts)).toEqual(new Set(['CHANGE_USER_ROLE']));
    await expect(page.getByText('E2E Admin').first()).toBeVisible(); // who did it

    await page.getByRole('button', { name: 'Reset filters' }).click();
    await expect(codes.filter({ hasText: 'APPROVE_USER' }).first()).toBeVisible();
  });

  test('doctors and nurses have no Users or Audit Log entry and are refused on the routes', async ({ page }) => {
    for (const role of ['doctor', 'nurse'] as const) {
      await login(page, role);
      await expect(page.getByRole('link', { name: 'Users' })).toHaveCount(0);
      await expect(page.getByRole('link', { name: 'Audit Log' })).toHaveCount(0);
      for (const path of ['/users', '/audit-logs']) {
        await page.goto(path);
        await expect(page.getByRole('alert')).toContainText('You do not have permission');
      }
      expect((await page.request.get(`${API_URL}/audit-logs`)).status()).toBe(403); // the server says no as well
      expect((await page.request.get(`${API_URL}/users`)).status()).toBe(403);
    }
  });
});
