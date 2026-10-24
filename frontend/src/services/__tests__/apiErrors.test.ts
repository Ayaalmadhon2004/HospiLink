import { describe, it, expect } from 'vitest';
import type { AxiosError, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { api } from '../api';

// Runs a failing response through the real response interceptor chain.
const rejectWith = async (status: number, data: unknown): Promise<Error & { code?: string }> => {
  const adapter = (config: InternalAxiosRequestConfig) =>
    Promise.reject({
      isAxiosError: true,
      message: 'Request failed',
      config,
      response: { status, data, headers: {}, config, statusText: '' } as AxiosResponse,
    } as AxiosError);
  try {
    await api.get('/x', { adapter });
  } catch (err) {
    return err as Error & { code?: string };
  }
  throw new Error('expected rejection');
};

describe('api error interceptor', () => {
  it('keeps the server message and exposes the code for the unified shape', async () => {
    const err = await rejectWith(400, { success: false, error: { code: 'VALIDATION_ERROR', message: 'email: invalid' } });
    expect(err.message).toBe('email: invalid');
    expect(err.code).toBe('VALIDATION_ERROR');
  });

  it('translates codes that have a locale entry', async () => {
    const err = await rejectWith(404, { success: false, error: { code: 'PATIENT_NOT_FOUND', message: 'Patient not found' } });
    expect(err.code).toBe('PATIENT_NOT_FOUND');
    expect(err.message).toBeTruthy();
    expect(err.message).not.toContain('errors.codes');
  });

  it('keeps the account codes on 403 so the login page can react', async () => {
    const err = await rejectWith(403, { success: false, error: { code: 'EMAIL_NOT_VERIFIED', message: 'Verify first' } });
    expect(err.code).toBe('EMAIL_NOT_VERIFIED');
  });

  it('still understands the legacy flat and string-error shapes', async () => {
    expect((await rejectWith(400, { success: false, message: 'old message' })).message).toBe('old message');
    expect((await rejectWith(401, { error: 'old string error' })).message).toBe('old string error');
  });
});
