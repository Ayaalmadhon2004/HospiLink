import { test, expect, type Page } from '@playwright/test';
import { login, admitPatient, openPatient, type TestPatient } from './helpers';

// One patient, several roles, in order: the later steps build on the records the earlier ones created.
test.describe.configure({ mode: 'serial' });

let patient: TestPatient;
const dialog = (page: Page) => page.getByRole('dialog').last();
const tab = (page: Page, name: string) => page.getByRole('tab', { name }).click();

test.describe('clinical records (real backend + database)', () => {
  test('doctor writes a progress note, amends it, and the original stays in the history', async ({ page }) => {
    await login(page, 'doctor');
    patient = await admitPatient(page, 'Clinical');
    await openPatient(page, patient);

    await page.getByRole('button', { name: 'Add note' }).click();
    await dialog(page).getByLabel('Note type').selectOption('PROGRESS');
    await dialog(page).getByRole('textbox').fill('Patient stable overnight');
    await dialog(page).getByRole('button', { name: 'Save note' }).click();
    await expect(dialog(page)).toBeHidden();

    const notes = page.getByRole('tabpanel');
    await expect(notes.getByText('Patient stable overnight')).toBeVisible();
    await expect(notes.getByText('E2E Doctor')).toBeVisible();
    await expect(notes.getByText('Progress', { exact: true })).toBeVisible();

    await notes.getByRole('button', { name: 'Amend' }).click();
    const box = dialog(page).getByRole('textbox');
    await expect(box).toHaveValue('Patient stable overnight'); // pre-filled with the current text
    await box.fill('Patient improving, discharge planned');
    await dialog(page).getByRole('button', { name: 'Save amendment' }).click();
    await expect(dialog(page)).toBeHidden();

    // The list shows the current version only, marked as amended; the first wording is one click away.
    await expect(notes.getByText('Patient improving, discharge planned')).toBeVisible();
    await expect(notes.getByText('Amended')).toBeVisible();
    await expect(notes.getByText('Patient stable overnight')).toHaveCount(0);
    await notes.getByRole('button', { name: 'Earlier versions' }).click();
    await expect(notes.getByText('Patient stable overnight')).toBeVisible();

    // Persisted: still there after a reload, and the API holds two rows (the original was never overwritten).
    await page.reload();
    await expect(page.getByRole('tabpanel').getByText('Patient improving, discharge planned')).toBeVisible();
    const res = await page.request.get(`http://localhost:5000/api/clinical-notes/${await firstNoteId(page)}/history`);
    expect(((await res.json()) as { data: unknown[] }).data).toHaveLength(2);
  });

  test('nurse can read it, cannot amend a doctor\'s note, and may only write nursing notes', async ({ page }) => {
    await login(page, 'nurse');
    await openPatient(page, patient);
    const notes = page.getByRole('tabpanel');

    await expect(notes.getByText('Patient improving, discharge planned')).toBeVisible();
    await expect(notes.getByRole('button', { name: 'Amend' })).toHaveCount(0);

    await page.getByRole('button', { name: 'Add note' }).click();
    const typeSelect = dialog(page).getByLabel('Note type');
    await expect(typeSelect.locator('option:not([value=""])')).toHaveText(['Nursing']); // no other type is offered
    await typeSelect.selectOption('NURSING');
    await dialog(page).getByRole('textbox').fill('Repositioned every two hours');
    await dialog(page).getByRole('button', { name: 'Save note' }).click();
    await expect(dialog(page)).toBeHidden();

    await expect(notes.getByText('Repositioned every two hours')).toBeVisible();
    await expect(notes.getByRole('button', { name: 'Amend' })).toHaveCount(1); // only her own nursing note
  });

  test('admin sees the records read-only', async ({ page }) => {
    await login(page, 'admin');
    await openPatient(page, patient);
    const notes = page.getByRole('tabpanel');
    await expect(notes.getByText('Repositioned every two hours')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add note' })).toHaveCount(0);
    await expect(notes.getByRole('button', { name: 'Amend' })).toHaveCount(0);
    await tab(page, 'Prescriptions');
    await expect(page.getByRole('button', { name: 'New prescription' })).toHaveCount(0);
    await tab(page, 'Lab results');
    await expect(page.getByRole('button', { name: 'Order lab test' })).toHaveCount(0);
  });

  test('doctor orders a lab test, nurse enters a critical result, and the result is flagged', async ({ page }) => {
    await login(page, 'doctor');
    await openPatient(page, patient);
    await tab(page, 'Lab results');
    await page.getByRole('button', { name: 'Order lab test' }).click();
    await dialog(page).getByLabel('Test').fill('Hemoglobin panel');
    await dialog(page).getByLabel('Priority').selectOption('URGENT');
    await dialog(page).getByRole('button', { name: 'Order lab test' }).click();
    await expect(dialog(page)).toBeHidden();
    const panel = page.getByRole('tabpanel');
    await expect(panel.getByText('Hemoglobin panel')).toBeVisible();
    await expect(panel.getByText('Awaiting results')).toBeVisible();
    await expect(panel.getByText('Urgent')).toBeVisible();

    // The nurse enters the numbers; the SERVER decides what is critical.
    await login(page, 'nurse');
    await openPatient(page, patient);
    await tab(page, 'Lab results');
    await page.getByRole('button', { name: 'Enter results' }).click();
    const form = dialog(page);
    await form.getByLabel('Value').fill('5');
    await form.getByLabel('Unit').fill('g/dL');
    await form.getByLabel('Normal from').fill('12');
    await form.getByLabel('Normal to').fill('17');
    await form.getByLabel('Critical below').fill('7');
    await form.getByRole('button', { name: 'Save results' }).click();
    await expect(form).toBeHidden();

    await expect(panel.getByText('Resulted')).toBeVisible();
    await expect(panel.getByText('Critical low')).toBeVisible();
    await expect(panel.getByRole('button', { name: 'Enter results' })).toHaveCount(0); // results are entered once
  });

  test('the doctor of the department is notified about the critical result (bell, over the real database)', async ({ page }) => {
    await login(page, 'doctor');
    const bell = page.getByRole('button', { name: 'Notifications', exact: true });
    await bell.click();
    await expect(page.getByText('Critical lab result').first()).toBeVisible();
    await expect(page.getByText(new RegExp(`${patient.name}.*Hemoglobin panel`)).first()).toBeVisible();
  });
});

async function firstNoteId(page: Page): Promise<string> {
  // Newest-first list of current versions: the head of the amendment chain for this patient.
  const list = await page.request.get(`http://localhost:5000/api/clinical-notes?patientId=${patient.id}&type=PROGRESS`);
  return ((await list.json()) as { data: { id: string }[] }).data[0].id;
}
