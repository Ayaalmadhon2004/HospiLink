import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { api } from '../api';
import { uploadReport } from '../patientService';

const originalAdapter = api.defaults.adapter;
const PDF = new File(['%PDF-1.4'], 'report.pdf', { type: 'application/pdf' });

describe('uploadReport', () => {
  const calls: { method?: string; url?: string; data?: unknown }[] = [];

  beforeEach(() => {
    calls.length = 0;
  });

  afterEach(() => {
    api.defaults.adapter = originalAdapter;
  });

  it('POSTs the file as multipart FormData to the patient reports endpoint', async () => {
    api.defaults.adapter = (config) => {
      calls.push({ method: config.method, url: config.url, data: config.data });
      return Promise.resolve({ status: 201, statusText: 'Created', data: { success: true }, headers: {}, config });
    };

    await uploadReport(PDF, 'p-1');

    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe('post');
    expect(calls[0].url).toBe('/patients/p-1/reports');
    const sent = calls[0].data as FormData;
    expect(sent).toBeInstanceOf(FormData);
    expect((sent.get('reportFile') as File).name).toBe('report.pdf');
  });

  it('throws when the server rejects the upload, so the UI cannot show a false success', async () => {
    api.defaults.adapter = (config) => {
      calls.push({ method: config.method, url: config.url, data: config.data });
      return Promise.reject(
        Object.assign(new Error('Failed to upload report'), { response: { status: 500, data: { message: 'Failed to upload report' } } }),
      );
    };

    await expect(uploadReport(PDF, 'p-1')).rejects.toThrow();
  });
});
