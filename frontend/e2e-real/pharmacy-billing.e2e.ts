import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'fs';
import { login, admitPatient, openPatient, type TestPatient } from './helpers';

// The whole medication-to-money journey on one patient, one role after the other:
// catalogue (doctor) -> stock (admin) -> prescription (doctor) -> dispense (nurse) -> invoice, payments, exports (admin).
test.describe.configure({ mode: 'serial' });

const RUN = Date.now();
const MED = `E2E Amoxil ${RUN}`;
let patient: TestPatient;
const dialog = (page: Page) => page.getByRole('dialog').last();
const tab = (page: Page, name: string) => page.getByRole('tab', { name }).click();
const stockRow = (page: Page) => page.getByRole('row', { name: new RegExp(MED) });

test.describe('pharmacy and billing (real backend + database)', () => {
  test('doctor adds a medication with a price and a reorder level to the catalogue', async ({ page }) => {
    await login(page, 'doctor');
    patient = await admitPatient(page, 'Pharmacy');
    await openPatient(page, patient);
    await tab(page, 'Prescriptions');
    await page.getByRole('button', { name: 'Medication catalogue' }).click();
    await page.getByRole('button', { name: 'Add medication' }).click();

    const form = dialog(page);
    await form.getByLabel(/^Name/).fill(MED);
    await form.getByLabel('Form').fill('capsule');
    await form.getByLabel('Strength').fill('500 mg');
    await form.getByLabel('Unit price').fill('2.50'); // decimals must pass the browser's own number validation
    await form.getByLabel('Reorder level').fill('5');
    await form.getByRole('button', { name: 'Add medication' }).click();
    await expect(page.getByText(`${MED} · capsule · 500 mg · $2.50`)).toBeVisible();
  });

  test('admin sees it as low stock, receives a delivery, and it is no longer low', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/pharmacy');
    await expect(stockRow(page)).toContainText('Low'); // 0 on hand <= reorder level 5
    await expect(stockRow(page)).toContainText('$2.50');

    await stockRow(page).getByRole('button', { name: 'Receive' }).click();
    await dialog(page).getByLabel('Units received').fill('20');
    await dialog(page).getByRole('button', { name: 'Save' }).click();
    await expect(dialog(page)).toBeHidden();
    await expect(stockRow(page).getByRole('cell').nth(1)).toHaveText('20');
    await expect(stockRow(page)).not.toContainText('Low');

    await page.getByLabel('Show low stock only').check();
    await expect(stockRow(page)).toHaveCount(0); // the filter is server-side and the item is no longer low
  });

  test('a negative adjustment needs a reason and cannot take stock below zero', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/pharmacy');
    await stockRow(page).getByRole('button', { name: 'Adjust' }).click();
    await dialog(page).getByLabel('Change (units)').fill('-500');
    await expect(dialog(page).getByRole('button', { name: 'Save' })).toBeDisabled(); // no reason yet
    await dialog(page).getByLabel('Reason').fill('Miscount');
    await dialog(page).getByRole('button', { name: 'Save' }).click();
    await expect(dialog(page).getByRole('alert')).toContainText('Not enough stock on hand.');
    await dialog(page).getByRole('button', { name: 'Close' }).click();
    await expect(stockRow(page).getByRole('cell').nth(1)).toHaveText('20'); // unchanged
  });

  test('doctor prescribes it', async ({ page }) => {
    await login(page, 'doctor');
    await openPatient(page, patient);
    await tab(page, 'Prescriptions');
    await page.getByRole('button', { name: 'New prescription' }).click();
    const form = dialog(page);
    await expect(form.getByRole('button', { name: 'Save prescription' })).toBeDisabled(); // incomplete item
    await form.getByLabel('Medication').selectOption({ label: `${MED} · capsule · 500 mg` });
    await form.getByLabel('Dose').fill('1 capsule');
    await form.getByLabel('Frequency').fill('TID');
    await form.getByLabel('Days').fill('5');
    await form.getByRole('button', { name: 'Save prescription' }).click();
    await expect(form).toBeHidden();
    const panel = page.getByRole('tabpanel');
    await expect(panel.getByText('Active', { exact: true })).toBeVisible();
    await expect(panel.getByText(new RegExp(`${MED} 500 mg`))).toBeVisible();
  });

  test('nurse dispenses: too many units is refused with a clear message, then 3 units succeed', async ({ page }) => {
    await login(page, 'nurse');
    await openPatient(page, patient);
    await tab(page, 'Prescriptions');
    await page.getByRole('button', { name: 'Dispense' }).click();
    const form = dialog(page);
    await form.getByLabel('Units to dispense').fill('100');
    await form.getByRole('button', { name: 'Dispense' }).click();
    await expect(form.getByRole('alert')).toContainText('Not enough stock on hand.');
    await form.getByLabel('Units to dispense').fill('3');
    await form.getByRole('button', { name: 'Dispense' }).click();
    await expect(form).toBeHidden();
  });

  test('stock dropped by exactly the dispensed amount (database and screen agree)', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/pharmacy');
    await expect(stockRow(page).getByRole('cell').nth(1)).toHaveText('17');
    const res = await page.request.get('http://localhost:5000/api/pharmacy/movements?type=DISPENSE');
    const rows = ((await res.json()) as { data: { delta: number; medication: { name: string } }[] }).data;
    expect(rows.filter((m) => m.medication.name === MED).map((m) => m.delta)).toEqual([-3]);
  });

  let invoiceUrl = '';

  test('admin invoices the patient: dispensed items arrive on the draft, extra line and discount adjust the total', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/billing');
    await page.getByRole('button', { name: 'New invoice' }).click();
    await dialog(page).getByRole('combobox', { name: /patient/i }).click();
    await page.getByRole('option', { name: new RegExp(patient.name) }).click();
    await dialog(page).getByRole('button', { name: 'Create draft' }).click();
    await expect(page).toHaveURL(/\/billing\/[\w-]+$/);
    invoiceUrl = page.url();

    await expect(page.getByRole('heading', { name: 'Draft' })).toBeVisible();
    const lines = page.getByRole('table');
    await expect(lines.getByRole('row', { name: new RegExp(MED) })).toContainText('3'); // quantity
    await expect(page.getByText('Total').last()).toBeVisible();
    await expect(page.locator('dd').last()).toHaveText('$7.50'); // 3 x $2.50

    await page.getByLabel('Description').fill('E2E consultation');
    await page.getByLabel('Unit price').fill('20');
    await page.getByRole('button', { name: 'Add item' }).click();
    await expect(page.locator('dd').last()).toHaveText('$27.50');

    await page.getByLabel('Discount').fill('2.50');
    await page.getByRole('button', { name: 'Apply discount' }).click();
    await expect(page.locator('dd').last()).toHaveText('$25.00');
  });

  test('issuing freezes it and numbers it; partial then full payment marks it paid', async ({ page }) => {
    await login(page, 'admin');
    await page.goto(invoiceUrl);
    await page.getByRole('button', { name: 'Issue invoice' }).click();
    await page.getByRole('button', { name: 'Confirm' }).click();
    await expect(page.getByRole('heading', { name: /^INV-\d{6}$/ })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add item' })).toHaveCount(0); // frozen
    await expect(page.getByRole('button', { name: 'Void' })).toBeVisible();

    await page.getByLabel('Amount').fill('10');
    await page.getByRole('button', { name: 'Record payment' }).click();
    await expect(page.getByText('Balance $15.00')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Void' })).toHaveCount(0); // something was paid

    await page.getByLabel('Amount').fill('16'); // more than the balance: the button refuses
    await expect(page.getByRole('button', { name: 'Record payment' })).toBeDisabled();
    await page.getByLabel('Amount').fill('15');
    await page.getByLabel('Method').selectOption('CARD');
    await page.getByLabel('Reference').fill('AUTH-E2E');
    await page.getByRole('button', { name: 'Record payment' }).click();
    await expect(page.getByText('Balance $0.00')).toBeVisible();
    await expect(page.getByText('Paid', { exact: true }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Record payment' })).toHaveCount(0);
    await expect(page.getByText(/AUTH-E2E/)).toBeVisible();
  });

  test('exports: a real Excel and a real PDF come down for billing', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/billing');
    await expect(page.getByRole('link', { name: /^INV-\d{6}$/ }).first()).toBeVisible();

    await page.getByRole('button', { name: 'Export' }).click();
    const [xlsx] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Excel' }).click()]);
    expect(xlsx.suggestedFilename()).toMatch(/^hospilink-billing-\d{4}-\d{2}-\d{2}\.xlsx$/);
    const xlsxBytes = readFileSync(await xlsx.path());
    expect(xlsxBytes.subarray(0, 2).toString()).toBe('PK'); // an .xlsx is a zip
    expect(xlsxBytes.length).toBeGreaterThan(1000);

    await page.getByRole('button', { name: 'Export' }).click();
    const [pdf] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'PDF' }).click()]);
    expect(pdf.suggestedFilename()).toMatch(/\.pdf$/);
    expect(readFileSync(await pdf.path()).subarray(0, 5).toString()).toBe('%PDF-');
  });

  test('patients export is offered to admin and doctor, never to a nurse; a bad period is refused before any request', async ({ page }) => {
    await login(page, 'nurse');
    await page.goto('/patients');
    await expect(page.getByRole('heading', { name: 'Patients' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Export' })).toHaveCount(0);

    await login(page, 'doctor');
    await page.goto('/patients');
    await page.getByRole('button', { name: 'Export' }).click();
    const menu = page.getByRole('dialog', { name: 'Export data' });
    await menu.getByLabel('From', { exact: true }).fill('2026-02-10');
    await menu.getByLabel('To', { exact: true }).fill('2026-02-01');
    await expect(menu.getByRole('alert')).toContainText('"From" must not be after "To"');
    await expect(menu.getByRole('button', { name: 'Excel' })).toBeDisabled();
    await menu.getByLabel('From', { exact: true }).fill('');
    await menu.getByLabel('To', { exact: true }).fill('');
    const [xlsx] = await Promise.all([page.waitForEvent('download'), menu.getByRole('button', { name: 'Excel' }).click()]);
    expect(xlsx.suggestedFilename()).toMatch(/^hospilink-patients-/);
  });

  test('role boundaries in the UI: doctor and nurse cannot open billing; nurse can read stock but not change it', async ({ page }) => {
    for (const role of ['doctor', 'nurse'] as const) {
      await login(page, role);
      await expect(page.getByRole('link', { name: 'Billing' })).toHaveCount(0);
      await page.goto('/billing');
      await expect(page.getByRole('alert')).toContainText('You do not have permission');
      await expect(page.getByRole('button', { name: 'New invoice' })).toHaveCount(0);
    }
    await login(page, 'nurse');
    await page.goto('/pharmacy');
    await expect(stockRow(page)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Receive' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Adjust' })).toHaveCount(0);
  });
});
