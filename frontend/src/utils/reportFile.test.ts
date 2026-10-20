import { describe, it, expect } from 'vitest';
import { MAX_REPORT_FILE_BYTES, isReportFileTooLarge } from './reportFile';

describe('reportFile', () => {
  it('matches the backend limit of 5 MB', () => {
    expect(MAX_REPORT_FILE_BYTES).toBe(5 * 1024 * 1024);
  });

  it('accepts a file of exactly the limit and rejects one byte more', () => {
    expect(isReportFileTooLarge(MAX_REPORT_FILE_BYTES)).toBe(false);
    expect(isReportFileTooLarge(MAX_REPORT_FILE_BYTES + 1)).toBe(true);
  });
});
