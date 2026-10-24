import { prismaMock } from './mocks/prisma';
import { dayRange, hourKey, formatLocal, hospitalTimezone } from '../src/utils/time';

describe('utils/time', () => {
  it('dayRange: Amman (UTC+3) day starts at 21:00Z the day before', () => {
    const { start, end } = dayRange('Asia/Amman', '2026-08-10');
    expect(start.toISOString()).toBe('2026-08-09T21:00:00.000Z');
    expect(end.toISOString()).toBe('2026-08-10T21:00:00.000Z');
  });

  it('dayRange: "today" is decided by the hospital zone, not the server', () => {
    // 22:30Z is already Aug 11 in Amman, still Aug 10 in UTC
    const ref = new Date('2026-08-10T22:30:00Z');
    expect(dayRange('Asia/Amman', ref).start.toISOString()).toBe('2026-08-10T21:00:00.000Z');
    expect(dayRange('UTC', ref).start.toISOString()).toBe('2026-08-10T00:00:00.000Z');
  });

  it('dayRange: a DST transition day is 25h long and does not mutate the input', () => {
    const { start, end } = dayRange('Europe/London', '2026-10-25');
    expect(end.getTime() - start.getTime()).toBe(25 * 3600 * 1000);
    const ref = new Date('2026-10-25T12:00:00Z');
    const copy = ref.getTime();
    dayRange('Europe/London', ref);
    expect(ref.getTime()).toBe(copy);
  });

  it('hourKey / formatLocal use the zone', () => {
    const d = new Date('2026-08-10T22:30:00Z');
    expect(hourKey(d, 'Asia/Amman')).toBe('01:00');
    expect(formatLocal(d, 'UTC')).toBe('2026-08-10 22:30 UTC');
  });

  it('hospitalTimezone: stored zone, else UTC (missing, invalid, or lookup failure)', async () => {
    prismaMock.hospital.findUnique.mockResolvedValueOnce({ timezone: 'Asia/Amman' } as any);
    expect(await hospitalTimezone('h1')).toBe('Asia/Amman');
    prismaMock.hospital.findUnique.mockResolvedValueOnce({ timezone: 'Bad/Zone' } as any);
    expect(await hospitalTimezone('h1')).toBe('UTC');
    prismaMock.hospital.findUnique.mockRejectedValueOnce(new Error('db'));
    expect(await hospitalTimezone('h1')).toBe('UTC');
  });
});
