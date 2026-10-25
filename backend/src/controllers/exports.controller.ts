import { Request, Response } from 'express';
import prisma from '../config/db';
import logger from '../config/logger';
import { hospitalIdOf } from '../utils/tenant';
import { fail } from '../utils/apiResponse';
import { LOADERS } from '../services/exports/datasets';
import { writeXlsx } from '../services/exports/xlsxWriter';
import { writePdf } from '../services/exports/pdfWriter';
import type { ExportFormat, ExportType } from '../services/exports/types';

export const MAX_EXPORT_ROWS = 10_000;
const DEFAULT_RANGE_DAYS = 30;
const MAX_RANGE_DAYS = 366;
const DAY_MS = 24 * 60 * 60 * 1000;

// Who may export what. Mirrors the read access of the screens each dataset comes from; billing follows /billing (ADMIN, BILLING).
const ALLOWED_ROLES: Record<ExportType, readonly string[]> = {
  patients: ['ADMIN', 'DOCTOR'],
  appointments: ['ADMIN', 'DOCTOR'],
  vitals: ['ADMIN', 'DOCTOR'],
  billing: ['ADMIN', 'BILLING'],
};

const MIME: Record<ExportFormat, string> = {
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pdf: 'application/pdf',
};

const day = (d: Date): string => d.toISOString().slice(0, 10);

// GET /api/exports/:type?format=xlsx|pdf&from=&to=
export const exportData = async (req: Request, res: Response) => {
  const type = req.params.type as ExportType;
  const { format, from, to } = req.query as { format: ExportFormat; from?: string; to?: string };
  try {
    if (!ALLOWED_ROLES[type].includes(req.user?.role ?? '')) return fail(res, 403, 'FORBIDDEN', 'Your role cannot export this data');

    const end = to ? new Date(to) : new Date();
    const start = from ? new Date(from) : new Date(end.getTime() - DEFAULT_RANGE_DAYS * DAY_MS);
    if (!(start < end)) return fail(res, 400, 'VALIDATION_ERROR', '"from" must be before "to"');
    if (end.getTime() - start.getTime() > MAX_RANGE_DAYS * DAY_MS) return fail(res, 400, 'VALIDATION_ERROR', `The period cannot exceed ${MAX_RANGE_DAYS} days`);

    const hospitalId = hospitalIdOf(req);
    const [data, hospital] = await Promise.all([
      LOADERS[type](hospitalId, { from: start, to: end }, MAX_EXPORT_ROWS + 1),
      prisma.hospital.findUnique({ where: { id: hospitalId }, select: { name: true } }),
    ]);
    // Refuse instead of silently dropping rows: a truncated financial or clinical export is worse than none.
    if (data.rows.length > MAX_EXPORT_ROWS) {
      return fail(res, 413, 'EXPORT_TOO_LARGE', `More than ${MAX_EXPORT_ROWS} rows match: narrow the period`);
    }

    const generatedAt = new Date();
    res.status(200);
    res.setHeader('Content-Type', MIME[format]);
    res.setHeader('Content-Disposition', `attachment; filename="hospilink-${type}-${day(generatedAt)}.${format}"`);
    res.setHeader('Cache-Control', 'no-store'); // patient data: never cached by a proxy or the browser
    const meta = { hospital: hospital?.name ?? 'HospiLink', generatedAt };
    if (format === 'xlsx') await writeXlsx(data, res, meta);
    else await writePdf(data, res, { ...meta, rangeLabel: `${day(start)} to ${day(end)}` });
  } catch (error: unknown) {
    logger.error({ err: error, type, format }, 'Export error:');
    if (res.headersSent) res.destroy(error instanceof Error ? error : undefined); // a half-written file must not look complete
    else fail(res, 500, 'INTERNAL_ERROR', 'Failed to generate the export');
  }
};
