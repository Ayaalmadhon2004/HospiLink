// backend/src/utils/time.ts
//
// Time-zone aware date helpers. The server runs in UTC (Render), so "today" must be computed in the
// hospital's zone (Hospital.timezone), never with Date#setHours. Everything here is immutable.
import { addDays } from 'date-fns';
import { fromZonedTime, formatInTimeZone } from 'date-fns-tz';
import prisma from '../config/db';
import logger from '../config/logger';
import { isValidTimeZone } from '../validators/settings.validator';

export const DEFAULT_TZ = 'UTC';

// Hospital zone, falling back to UTC when missing/invalid or the lookup fails (never throws).
export const hospitalTimezone = async (hospitalId: string): Promise<string> => {
  try {
    const h = await prisma.hospital.findUnique({ where: { id: hospitalId }, select: { timezone: true } });
    return h?.timezone && isValidTimeZone(h.timezone) ? h.timezone : DEFAULT_TZ;
  } catch (err) {
    logger.error({ err, hospitalId }, '[time] hospital timezone lookup failed, using UTC');
    return DEFAULT_TZ;
  }
};

// Half-open UTC range [start, end) of the local calendar day in `tz`.
// `ref` is an instant, or a "YYYY-MM-DD" (or ISO) string whose date part is the local day wanted.
export const dayRange = (tz: string, ref: Date | string = new Date()): { start: Date; end: Date } => {
  const ymd = typeof ref === 'string' ? ref.slice(0, 10) : formatInTimeZone(ref, tz, 'yyyy-MM-dd');
  const nextYmd = addDays(new Date(`${ymd}T00:00:00Z`), 1).toISOString().slice(0, 10);
  return { start: fromZonedTime(`${ymd}T00:00:00`, tz), end: fromZonedTime(`${nextYmd}T00:00:00`, tz) };
};

export const hourKey = (d: Date | string, tz: string): string => formatInTimeZone(new Date(d), tz, 'HH:00');

export const formatLocal = (d: Date | string, tz: string): string =>
  formatInTimeZone(new Date(d), tz, 'yyyy-MM-dd HH:mm zzz');
