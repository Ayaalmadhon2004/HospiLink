// backend/src/services/exports/xlsxWriter.ts
import type { Writable } from 'stream';
import ExcelJS from 'exceljs';
import { sanitizeCell } from './sanitize';
import { MINOR_PER_MAJOR } from './format';
import type { CellValue, ExportColumn, ExportDataset } from './types';

const NUM_FORMAT: Partial<Record<ExportColumn['kind'], string>> = { money: '#,##0.00', datetime: 'yyyy-mm-dd hh:mm' };

const toCell = (kind: ExportColumn['kind'], v: CellValue): string | number | boolean | Date | null => {
  if (v === null) return null;
  if (typeof v === 'string') return sanitizeCell(v);
  if (kind === 'money' && typeof v === 'number') return v / MINOR_PER_MAJOR;
  return v;
};

/** Streams the workbook to `out`; styled header row, frozen, auto-filter, real numbers/dates (not text) so Excel can sort and sum. */
export const writeXlsx = async (data: ExportDataset, out: Writable, meta: { hospital: string; generatedAt: Date }): Promise<void> => {
  const wb = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: out, useStyles: true });
  wb.creator = 'HospiLink';
  wb.created = meta.generatedAt;
  const ws = wb.addWorksheet(data.title, { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = data.columns.map((c) => ({ header: c.header, key: c.key, width: c.width, style: NUM_FORMAT[c.kind] ? { numFmt: NUM_FORMAT[c.kind] } : {} }));
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: data.columns.length } };
  const header = ws.getRow(1);
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
  header.commit();
  for (const row of data.rows) {
    const values: Record<string, ReturnType<typeof toCell>> = {};
    for (const c of data.columns) values[c.key] = toCell(c.kind, row[c.key] ?? null);
    ws.addRow(values).commit();
  }
  ws.commit();
  await wb.commit();
};
