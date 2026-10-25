import { PassThrough } from 'stream';
import ExcelJS from 'exceljs';
import { sanitizeCell } from '../../../src/services/exports/sanitize';
import { displayValue } from '../../../src/services/exports/format';
import { writeXlsx } from '../../../src/services/exports/xlsxWriter';
import { writePdf } from '../../../src/services/exports/pdfWriter';
import type { ExportDataset } from '../../../src/services/exports/types';

const collect = async (run: (out: PassThrough) => Promise<void>): Promise<Buffer> => {
  const out = new PassThrough();
  const chunks: Buffer[] = [];
  out.on('data', (c: Buffer) => chunks.push(c));
  await run(out);
  return Buffer.concat(chunks);
};

const meta = { hospital: 'Test Hospital', generatedAt: new Date('2026-02-01T10:00:00Z') };
const dataset = (rows: ExportDataset['rows']): ExportDataset => ({
  title: 'Invoices',
  columns: [
    { key: 'name', header: 'Name', kind: 'text', width: 20 },
    { key: 'total', header: 'Total', kind: 'money', width: 10 },
    { key: 'at', header: 'At', kind: 'datetime', width: 16 },
    { key: 'critical', header: 'Critical', kind: 'bool', width: 8 },
    { key: 'age', header: 'Age', kind: 'number', width: 6 },
  ],
  rows,
});

describe('sanitizeCell (spreadsheet formula injection)', () => {
  it.each(['=1+1', '+SUM(A1)', '-2+3', '@cmd', '\tx', '\rx', '=HYPERLINK("http://evil","click")'])('neutralises %j', (v) => {
    expect(sanitizeCell(v)).toBe(`'${v}`);
  });
  it.each(['Ali Hassan', 'A=B', '1+1', 'x-ray', 'مريض', ''])('leaves %j alone', (v) => expect(sanitizeCell(v)).toBe(v));
});

describe('displayValue', () => {
  it('formats money (minor -> major), booleans, dates (UTC) and blanks', () => {
    expect(displayValue('money', 123456)).toBe('1234.56');
    expect(displayValue('money', 5)).toBe('0.05');
    expect(displayValue('bool', true)).toBe('Yes');
    expect(displayValue('bool', false)).toBe('No');
    expect(displayValue('datetime', new Date('2026-01-02T03:04:59Z'))).toBe('2026-01-02 03:04');
    expect(displayValue('text', null)).toBe('');
    expect(displayValue('number', 0)).toBe('0');
  });
});

describe('writeXlsx', () => {
  it('writes typed cells: numbers stay numbers, money is in major units, dates are dates, and text formulas are neutralised', async () => {
    const buf = await collect((out) => writeXlsx(dataset([
      { name: '=HYPERLINK("http://evil","x")', total: 123456, at: new Date('2026-01-02T03:04:00Z'), critical: true, age: 41 },
      { name: 'Ali', total: 0, at: null, critical: false, age: null },
    ]), out, meta));
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as unknown as ArrayBuffer);
    const ws = wb.getWorksheet('Invoices')!;
    expect(ws.getRow(1).values).toEqual([undefined, 'Name', 'Total', 'At', 'Critical', 'Age']);
    const r2 = ws.getRow(2);
    expect(r2.getCell(1).value).toBe(`'=HYPERLINK("http://evil","x")`);
    expect(r2.getCell(2).value).toBe(1234.56);
    expect(r2.getCell(3).value).toEqual(new Date('2026-01-02T03:04:00Z'));
    expect(r2.getCell(4).value).toBe(true);
    expect(r2.getCell(5).value).toBe(41);
    expect(ws.getRow(3).getCell(3).value).toBeNull();
    expect(ws.rowCount).toBe(3);
    expect(ws.views[0]).toMatchObject({ state: 'frozen', ySplit: 1 });
  });

  it('an empty dataset still yields a valid workbook with the header only', async () => {
    const buf = await collect((out) => writeXlsx(dataset([]), out, meta));
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as unknown as ArrayBuffer);
    expect(wb.getWorksheet('Invoices')!.rowCount).toBe(1);
  });
});

describe('writePdf', () => {
  const many = (n: number) => Array.from({ length: n }, (_, i) => ({ name: `Patient ${i} ${'long text '.repeat(i % 7)}`, total: 100 * i, at: new Date('2026-01-02T03:04:00Z'), critical: i % 2 === 0, age: i }));
  const pageCount = (buf: Buffer) => (buf.toString('latin1').match(/\/Type \/Page\b/g) ?? []).length;

  it('produces a PDF; many rows paginate and there is no blank page after each page (footer regression)', async () => {
    const small = await collect((out) => writePdf(dataset(many(3)), out, { ...meta, rangeLabel: 'a to b' }));
    expect(small.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pageCount(small)).toBe(1);
    const big = await collect((out) => writePdf(dataset(many(200)), out, { ...meta, rangeLabel: 'a to b' }));
    const pages = pageCount(big);
    expect(pages).toBeGreaterThan(2);
    expect(pages).toBeLessThan(20); // 200 short rows cannot need twice as many pages as content
  });

  it('an empty dataset is still a one-page PDF', async () => {
    const buf = await collect((out) => writePdf(dataset([]), out, { ...meta, rangeLabel: 'a to b' }));
    expect(pageCount(buf)).toBe(1);
  });
});
