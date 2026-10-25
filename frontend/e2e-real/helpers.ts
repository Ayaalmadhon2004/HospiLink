import { expect, type Page } from '@playwright/test';

// Created by backend/prisma/seed.e2e.ts (throwaway database only).
export const SEED_ADMIN = { email: 'e2e.admin@hospilink.test', password: 'E2e-Password-123!' };
export const SEED_DOCTOR = { email: 'e2e.doctor@hospilink.test', password: 'E2e-Password-123!' };
export const SEED_NURSE = { email: 'e2e.nurse@hospilink.test', password: 'E2e-Password-123!' };

export type Role = 'admin' | 'doctor' | 'nurse';
const ACCOUNTS: Record<Role, { email: string; password: string }> = { admin: SEED_ADMIN, doctor: SEED_DOCTOR, nurse: SEED_NURSE };

export const API_URL = 'http://localhost:5000/api';

// Matches a URL ending in /dashboard ("http://localhost:4173/dashboard"), not "/login".
const DASHBOARD_URL = /\/dashboard$/;

type Cookies = Awaited<ReturnType<ReturnType<Page['context']>['cookies']>>;

// One sign-in per role for the whole run (the suite uses a single worker): later tests reuse that session cookie.
// (The auth endpoints are rate limited in production; the E2E API raises the limit, see playwright.real.config.ts.)
const sessions = new Map<Role, Cookies>();

/** Signs in through the login form (the real flow). Use it only where the sign-in itself is under test. */
export async function loginViaUi(page: Page, role: Role = 'admin'): Promise<void> {
  const account = ACCOUNTS[role];
  await page.goto('/login');
  await page.getByPlaceholder('doctor@hospital.com').fill(account.email);
  await page.getByPlaceholder('••••••••').fill(account.password);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page).toHaveURL(DASHBOARD_URL);
  sessions.set(role, await page.context().cookies());
}

/** Gets a page signed in as `role` (default admin): reuses that role's cached session, otherwise signs in through the UI. */
export async function login(page: Page, role: Role = 'admin'): Promise<void> {
  const cookies = sessions.get(role);
  if (!cookies) {
    await loginViaUi(page, role);
    return;
  }
  await page.context().addCookies(cookies);
  await page.goto('/dashboard');
  await expect(page).toHaveURL(DASHBOARD_URL);
}

export interface TestPatient {
  id: string;
  name: string;
  patientCode: string;
}

/** Admits a uniquely named "General" department patient through the real API with the page's session (admin or doctor/nurse). */
export async function admitPatient(page: Page, label = 'Flow'): Promise<TestPatient> {
  const name = `E2E ${label} ${Date.now()}`;
  const res = await page.request.post(`${API_URL}/patients/admit`, {
    data: { name, age: 41, gender: 'MALE', department: 'General', diagnosis: 'E2E diagnosis' },
  });
  expect(res.status()).toBe(201);
  const { data } = (await res.json()) as { data: TestPatient };
  return { id: data.id, name, patientCode: data.patientCode };
}

/** Opens a patient's detail page by id and waits for the clinical section. */
export async function openPatient(page: Page, patient: TestPatient): Promise<void> {
  await page.goto(`/patients/${patient.id}`);
  await expect(page.getByRole('heading', { name: 'Clinical records' })).toBeVisible();
}
