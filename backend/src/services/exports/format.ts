// backend/src/services/exports/format.ts
import type { CellValue, ExportColumn } from './types';

export const MINOR_PER_MAJOR = 100;

/** Text form of a cell for the PDF writer (and tests). Dates are UTC: the PDF header says so. */
export const displayValue = (kind: ExportColumn['kind'], v: CellValue): string => {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? '' : v.toISOString().slice(0, 16).replace('T', ' ');
  if (kind === 'money' && typeof v === 'number') return (v / MINOR_PER_MAJOR).toFixed(2);
  if (kind === 'bool') return v ? 'Yes' : 'No';
  return String(v);
};
