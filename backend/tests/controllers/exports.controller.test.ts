import { PassThrough } from 'stream';
import { prismaMock } from '../mocks/prisma';
import { mockRequest } from '../mocks/http';
import { exportData, MAX_EXPORT_ROWS } from '../../src/controllers/exports.controller';

jest.mock('../../src/services/exports/datasets', () => ({ LOADERS: { patients: jest.fn(), appointments: jest.fn(), vitals: jest.fn(), billing: jest.fn() } }));
jest.mock('../../src/services/exports/xlsxWriter', () => ({ writeXlsx: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../../src/services/exports/pdfWriter', () => ({ writePdf: jest.fn().mockResolvedValue(undefined) }));
import { LOADERS } from '../../src/services/exports/datasets';
import { writeXlsx } from '../../src/services/exports/xlsxWriter';
import { writePdf } from '../../src/services/exports/pdfWriter';

const loader = (t: keyof typeof LOADERS) => LOADERS[t] as unknown as jest.Mock;
const dataset = (n = 2) => ({ title: 'T', columns: [], rows: Array.from({ length: n }, () => ({})) });

const res = () => {
  const r: any = new PassThrough();
  r.headers = {} as Record<string, string>;
  r.headersSent = false;
  r.setHeader = (k: string, v: string) => { r.headers[k] = v; };
  r.status = jest.fn().mockReturnValue(r);
  r.json = jest.fn().mockReturnValue(r);
  r.destroy = jest.fn();
  return r;
};
const as = (role: string, type: string, query: object = {}) => mockRequest({ user: { id: 'u1', email: 'e', role, hospitalId: 'hosp-1' }, params: { type }, query: { format: 'xlsx', ...query } } as any);
const code = (r: any) => r.json.mock.calls[0][0].error?.code;

beforeEach(() => {
  jest.clearAllMocks();
  prismaMock.hospital.findUnique.mockResolvedValue({ name: 'City Hospital' } as any);
  (Object.keys(LOADERS) as (keyof typeof LOADERS)[]).forEach((t) => loader(t).mockResolvedValue(dataset()));
});

describe('exportData', () => {
  it.each([['NURSE', 'patients'], ['DISPATCHER', 'vitals'], ['DOCTOR', 'billing'], ['NURSE', 'billing']])('%s may not export %s (403, nothing loaded)', async (role, type) => {
    const r = res();
    await exportData(as(role, type), r);
    expect(r.status).toHaveBeenCalledWith(403);
    expect(loader(type as keyof typeof LOADERS)).not.toHaveBeenCalled();
  });

  it.each([['ADMIN', 'billing'], ['ADMIN', 'patients'], ['DOCTOR', 'patients'], ['DOCTOR', 'appointments'], ['DOCTOR', 'vitals']])('%s may export %s', async (role, type) => {
    const r = res();
    await exportData(as(role, type), r);
    expect(loader(type as keyof typeof LOADERS)).toHaveBeenCalledWith('hosp-1', expect.any(Object), MAX_EXPORT_ROWS + 1);
    expect(writeXlsx).toHaveBeenCalledTimes(1);
  });

  it('sets download headers (attachment, no-store, xlsx mime) and passes the hospital name', async () => {
    const r = res();
    await exportData(as('ADMIN', 'patients'), r);
    expect(r.headers['Content-Type']).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    expect(r.headers['Content-Disposition']).toMatch(/^attachment; filename="hospilink-patients-\d{4}-\d{2}-\d{2}\.xlsx"$/);
    expect(r.headers['Cache-Control']).toBe('no-store');
    expect((writeXlsx as jest.Mock).mock.calls[0][2]).toMatchObject({ hospital: 'City Hospital' });
  });

  it('pdf format uses the PDF writer with a readable range label', async () => {
    const r = res();
    await exportData(as('ADMIN', 'billing', { format: 'pdf', from: '2026-01-01T00:00:00Z', to: '2026-02-01T00:00:00Z' }), r);
    expect(r.headers['Content-Type']).toBe('application/pdf');
    expect(writePdf).toHaveBeenCalledTimes(1);
    expect((writePdf as jest.Mock).mock.calls[0][2].rangeLabel).toBe('2026-01-01 to 2026-02-01');
    expect(writeXlsx).not.toHaveBeenCalled();
  });

  it('defaults to the last 30 days; the range is half-open and passed to the loader', async () => {
    const r = res();
    await exportData(as('ADMIN', 'patients'), r);
    const range = loader('patients').mock.calls[0][1] as { from: Date; to: Date };
    expect(Math.round((range.to.getTime() - range.from.getTime()) / 86_400_000)).toBe(30);
  });

  it('400 for an inverted range or a period longer than 366 days', async () => {
    const a = res();
    await exportData(as('ADMIN', 'patients', { from: '2026-02-01T00:00:00Z', to: '2026-01-01T00:00:00Z' }), a);
    expect(a.status).toHaveBeenCalledWith(400);
    const b = res();
    await exportData(as('ADMIN', 'patients', { from: '2024-01-01T00:00:00Z', to: '2026-01-01T00:00:00Z' }), b);
    expect(b.status).toHaveBeenCalledWith(400);
    expect(loader('patients')).not.toHaveBeenCalled();
  });

  it('413 EXPORT_TOO_LARGE instead of a truncated file when more than the cap matches', async () => {
    loader('patients').mockResolvedValue(dataset(MAX_EXPORT_ROWS + 1));
    const r = res();
    await exportData(as('ADMIN', 'patients'), r);
    expect(r.status).toHaveBeenCalledWith(413);
    expect(code(r)).toBe('EXPORT_TOO_LARGE');
    expect(writeXlsx).not.toHaveBeenCalled();
    expect(r.headers['Content-Disposition']).toBeUndefined();
  });

  it('exactly the cap is allowed', async () => {
    loader('patients').mockResolvedValue(dataset(MAX_EXPORT_ROWS));
    const r = res();
    await exportData(as('ADMIN', 'patients'), r);
    expect(writeXlsx).toHaveBeenCalled();
  });

  it('500 JSON when loading fails before anything is sent; the stream is destroyed when it fails midway', async () => {
    loader('patients').mockRejectedValueOnce(new Error('db down'));
    const a = res();
    await exportData(as('ADMIN', 'patients'), a);
    expect(a.status).toHaveBeenCalledWith(500);

    (writeXlsx as jest.Mock).mockImplementationOnce(async () => { throw new Error('disk'); });
    const b = res();
    b.headersSent = true;
    await exportData(as('ADMIN', 'patients'), b);
    expect(b.destroy).toHaveBeenCalled();
  });
});
