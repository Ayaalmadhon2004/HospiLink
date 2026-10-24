import { prismaMock } from '../mocks/prisma';
import { findDoctorConflict, isOverlapViolation } from '../../src/services/appointmentConflicts';

const row = (iso: string, duration: number) => ({ id: iso, scheduledAt: new Date(iso), duration });
const query = (start: string, durationMin: number) => ({ doctorId: 'd1', start: new Date(start), durationMin });

// "Starts exactly when the new one ends" is excluded by the query itself (scheduledAt < end); covered against a real database.
describe('findDoctorConflict', () => {
  it('scopes the lookup to the doctor, ignores cancelled and excludes the edited appointment', async () => {
    prismaMock.appointment.findMany.mockResolvedValue([]);

    await findDoctorConflict({ ...query('2026-11-01T10:00:00Z', 30), excludeId: 'me' });

    const where = (prismaMock.appointment.findMany.mock.calls[0][0] as any).where;
    expect(where).toMatchObject({ doctorId: 'd1', status: { not: 'CANCELLED' }, id: { not: 'me' } });
    expect(where.scheduledAt.lt).toEqual(new Date('2026-11-01T10:30:00Z'));
    expect(where.scheduledAt.gt).toEqual(new Date('2026-10-31T10:00:00Z')); // 24h before: max duration
  });

  it.each([
    ['existing long one covers the start (09:00+120m vs 10:30)', row('2026-11-01T09:00:00Z', 120), '2026-11-01T10:30:00Z', 30, true],
    ['existing starts inside the new one', row('2026-11-01T10:15:00Z', 30), '2026-11-01T10:00:00Z', 30, true],
    ['new one is fully inside a long existing one', row('2026-11-01T08:00:00Z', 600), '2026-11-01T12:00:00Z', 15, true],
    ['identical slot', row('2026-11-01T10:00:00Z', 30), '2026-11-01T10:00:00Z', 30, true],
    ['existing ends exactly when the new one starts', row('2026-11-01T09:30:00Z', 30), '2026-11-01T10:00:00Z', 30, false],
    ['short existing one ended well before', row('2026-11-01T09:00:00Z', 30), '2026-11-01T10:00:00Z', 30, false],
  ])('%s', async (_name, existing, start, durationMin, expected) => {
    prismaMock.appointment.findMany.mockResolvedValue([existing]);
    const found = await findDoctorConflict(query(start, durationMin));
    expect(Boolean(found)).toBe(expected);
  });
});

describe('isOverlapViolation', () => {
  it('recognises the Postgres code, the constraint name and nested causes', () => {
    expect(isOverlapViolation({ code: '23P01' })).toBe(true);
    expect(isOverlapViolation(new Error('conflicting key value violates exclusion constraint "appointment_no_doctor_overlap"'))).toBe(true);
    expect(isOverlapViolation({ code: 'P2010', meta: { message: 'appointment_no_doctor_overlap' } })).toBe(true);
    expect(isOverlapViolation({ message: 'wrapped', cause: { cause: { code: '23P01' } } })).toBe(true);
  });

  it('ignores unrelated errors and survives cycles / non-objects', () => {
    expect(isOverlapViolation(new Error('boom'))).toBe(false);
    expect(isOverlapViolation({ code: 'P2002' })).toBe(false);
    expect(isOverlapViolation(null)).toBe(false);
    expect(isOverlapViolation('23P01')).toBe(false);
    const loop: { cause?: unknown } = {};
    loop.cause = loop;
    expect(isOverlapViolation(loop)).toBe(false);
  });
});
