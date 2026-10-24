// backend/src/services/appointmentConflicts.ts
import prisma from '../config/db';

const MINUTE_MS = 60_000;
// Appointment.duration is capped at 1440 minutes by the validator: no appointment that overlaps a
// slot can start earlier than this before it.
const MAX_DURATION_MS = 1440 * MINUTE_MS;

// Same name as the exclusion constraint created in migration 20261026000000_appointment_overlap.
export const OVERLAP_CONSTRAINT = 'appointment_no_doctor_overlap';

interface ConflictQuery {
  doctorId: string;
  start: Date;
  durationMin: number;
  /** The appointment being edited, so it does not conflict with itself. */
  excludeId?: string;
}

/**
 * First non-cancelled appointment of the doctor that overlaps [start, start + duration), or null.
 * Two intervals overlap when existing.start < newEnd AND existing.end > newStart, each with its OWN duration.
 */
export const findDoctorConflict = async ({ doctorId, start, durationMin, excludeId }: ConflictQuery) => {
  const end = new Date(start.getTime() + durationMin * MINUTE_MS);
  const candidates = await prisma.appointment.findMany({
    where: {
      doctorId,
      status: { not: 'CANCELLED' },
      ...(excludeId ? { id: { not: excludeId } } : {}),
      scheduledAt: { gt: new Date(start.getTime() - MAX_DURATION_MS), lt: end },
    },
    select: { id: true, scheduledAt: true, duration: true },
  });
  return candidates.find((a) => a.scheduledAt.getTime() + a.duration * MINUTE_MS > start.getTime()) ?? null;
};

/**
 * True when the database rejected a write through the overlap exclusion constraint
 * (two concurrent requests that both passed findDoctorConflict). Driver adapters wrap the
 * Postgres error differently across versions, so the code/name are searched along the cause chain.
 */
export const isOverlapViolation = (error: unknown): boolean => {
  const seen = new Set<unknown>();
  let current: unknown = error;
  while (current && typeof current === 'object' && !seen.has(current)) {
    seen.add(current);
    const e = current as { code?: unknown; message?: unknown; meta?: unknown; cause?: unknown };
    if (e.code === '23P01') return true;
    if (typeof e.message === 'string' && e.message.includes(OVERLAP_CONSTRAINT)) return true;
    if (e.meta && JSON.stringify(e.meta).includes(OVERLAP_CONSTRAINT)) return true;
    current = e.cause;
  }
  return false;
};
