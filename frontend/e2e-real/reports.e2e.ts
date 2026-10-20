import { test, expect, type Page } from '@playwright/test';
import { login } from './helpers';

const API_URL = 'http://localhost:5000/api';
const MAX_REPORT_BYTES = 5 * 1024 * 1024;
// Patient detail URL: ".../patients/3f2a-91" matches, ".../patients" does not.
const PATIENT_DETAIL_URL = /\/patients\/([\w-]+)$/;
// Smallest PDF-looking payload; the backend only checks the MIME type and the size.
const TINY_PDF = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n');


const openUploadDialog = async (page: Page) => {
  await page.getByRole('button', { name: 'Upload Report' }).click();
  const dialog = page.getByRole('dialog', { name: 'Upload Report' });
  await expect(dialog).toBeVisible();
  return dialog;
};

// The auth endpoints are rate limited (20 requests per 15 minutes, see backend/src/server.ts) and the
// rest of the suite already logs in several times, so this file signs in once and shares the session.
test.describe.serial('report upload (real backend + database)', () => {
  let page: Page;
  let patientId: string;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await login(page);
    // One page load only: every full load calls /auth/me, which counts against that limit.
    await page.goto('/patients');
    await page.getByLabel('View details for Seeded Patient One').click();
    await expect(page).toHaveURL(PATIENT_DETAIL_URL);
    patientId = PATIENT_DETAIL_URL.exec(page.url())![1];
  });

  test.afterAll(async () => {
    await page.close();
  });

  test('uploads a PDF, lists it after a reload and serves it back', async () => {
    // Unique per run so the test also passes on a database that was not reset.
    const fileName = `e2e-report-${Date.now()}.pdf`;
    const dialog = await openUploadDialog(page);
    await dialog.locator('input[type="file"]').setInputFiles({
      name: fileName,
      mimeType: 'application/pdf',
      buffer: TINY_PDF,
    });
    await dialog.getByRole('button', { name: 'Upload', exact: true }).click();
    await expect(dialog.getByText('Report uploaded successfully!')).toBeVisible();
    await expect(dialog).toBeHidden();

    // Stored in PostgreSQL (Report.fileData), not just in the client state.
    await page.reload();
    const reports = page.getByRole('list', { name: 'Patient reports' });
    await expect(reports.getByText(fileName)).toBeVisible();

    // The file is served back, authenticated, with the bytes that were uploaded.
    const fileResponse = page.waitForResponse((r) => /\/patients\/reports\/[\w-]+\/file$/.test(r.url()));
    await page.getByRole('button', { name: `View report: ${fileName}` }).click();
    const response = await fileResponse;
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('application/pdf');
    expect(Buffer.compare(await response.body(), TINY_PDF)).toBe(0);
  });

  test('rejects a file over 5 MB in the UI and does not list it', async () => {
    const fileName = `e2e-too-big-${Date.now()}.pdf`;
    const dialog = await openUploadDialog(page);
    await dialog.locator('input[type="file"]').setInputFiles({
      name: fileName,
      mimeType: 'application/pdf',
      buffer: Buffer.alloc(MAX_REPORT_BYTES + 1),
    });
    await expect(dialog.getByRole('alert')).toContainText('less than 5MB');
    await expect(dialog.getByRole('button', { name: 'Upload', exact: true })).toBeDisabled();

    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByText(fileName)).toHaveCount(0);
  });

  test('the API itself refuses a file over 5 MB', async () => {
    // Same cookie session as the browser; bypasses the client-side check.
    const response = await page.context().request.post(`${API_URL}/patients/${patientId}/reports`, {
      multipart: {
        reportFile: { name: 'too-big.pdf', mimeType: 'application/pdf', buffer: Buffer.alloc(MAX_REPORT_BYTES + 1) },
      },
    });
    expect(response.ok()).toBe(false);
  });

  test('the API refuses a file type that is not PDF, JPEG or PNG', async () => {
    const response = await page.context().request.post(`${API_URL}/patients/${patientId}/reports`, {
      multipart: { reportFile: { name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') } },
    });
    expect(response.ok()).toBe(false);
  });
});
