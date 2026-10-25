import { describe, it, expect } from 'vitest';
import { AxiosError, type AxiosResponse } from 'axios';
import i18n from '../i18n';
import { toApiError } from './normalizeApiError';

const failure = (status: number, code: string, message: string): AxiosError => {
  const err = new AxiosError('Request failed');
  err.response = { status, data: { success: false, error: { code, message } } } as AxiosResponse;
  return err;
};

describe('toApiError', () => {
  it('translates known codes in the active language', async () => {
    expect(toApiError(failure(409, 'LAST_ADMIN', 'x')).message).toBe('The hospital must keep at least one active admin.');
    await i18n.changeLanguage('ar');
    expect(toApiError(failure(404, 'NOT_FOUND', 'x')).message).toBe('العنصر المطلوب غير موجود.');
    expect(toApiError(failure(413, 'EXPORT_TOO_LARGE', 'x')).message).toContain('10000');
  });

  it('keeps the server detail for validation errors and conflicts', () => {
    expect(toApiError(failure(400, 'VALIDATION_ERROR', 'name is required')).message).toBe('name is required');
    expect(toApiError(failure(409, 'CONFLICT', 'Bed already taken')).message).toBe('Bed already taken');
  });
});
