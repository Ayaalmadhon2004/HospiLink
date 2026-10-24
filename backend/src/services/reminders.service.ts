// backend/src/services/reminders.service.ts
//
// Time-based reminders built on `notify()`: shifts and appointments starting within the
// next 30 minutes. Recipients come from Staff.userId (an explicit link; staff without one are
// logged and skipped). Triggered from outside the web process (POST /api/internal/run-reminders,
// see docs/NOTIFICATIONS.md), so it works with several instances and with Render sleeping.
// Idempotent and race-free: a reminder is claimed through the unique key of ReminderLog
// (INSERT ... ON CONFLICT DO NOTHING); only the caller that inserts the row sends it. If nothing
// was delivered (setting off, notify failed) the claim is released so a later run can retry
// until the item starts. Claims, lookups and inserts are batched per run (no per-item queries). Times are formatted in the hospital's time zone. Never throws.
import prisma from '../config/db';
import logger from '../config/logger';
import { notifyBatch, type NotifyInput } from './notification.service';
import { formatLocal, hospitalTimezones } from '../utils/time';

export const REMINDER_LEAD_MS = 30 * 60 * 1000;
const LOG_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

type Kind = 'SHIFT' | 'APPOINTMENT';
type Pending = { userId: string; dedupeKey: string; input: NotifyInput };

const release = async (kind: Kind, items: Pending[]): Promise<void> => {
  if (!items.length) return;
  try {
    await prisma.reminderLog.deleteMany({
      where: { OR: items.map(({ userId, dedupeKey }) => ({ userId, kind, dedupeKey })) },
    });
  } catch (err) {
    logger.error({ err, kind, count: items.length }, '[Reminders] failed to release claims');
  }
};

// Batched claim -> notify -> release: one insert claims every candidate (only newly inserted rows
// come back, so a concurrent run never sends the same reminder), one lookup + one insert deliver them,
// and one delete releases the claims that delivered nothing. Returns recipients notified.
const deliver = async (kind: Kind, items: Pending[]): Promise<number> => {
  if (!items.length) return 0;
  const claimed = await prisma.reminderLog.createManyAndReturn({
    data: items.map(({ userId, dedupeKey }) => ({ userId, kind, dedupeKey })),
    skipDuplicates: true,
    select: { userId: true, dedupeKey: true },
  });
  const won = new Set((claimed ?? []).map((c) => `${c.userId}|${c.dedupeKey}`));
  const mine = items.filter((i) => won.has(`${i.userId}|${i.dedupeKey}`));
  if (!mine.length) return 0;

  try {
    const results = await notifyBatch(mine.map((i) => i.input));
    await release(kind, mine.filter((_, idx) => results[idx].length === 0));
    return results.reduce((n, r) => n + r.length, 0);
  } catch (err) {
    await release(kind, mine);
    throw err;
  }
};

export const sendShiftReminders = async (now: Date = new Date()): Promise<number> => {
  try {
    const shifts = await prisma.shift.findMany({
      where: { startTime: { gt: now, lte: new Date(now.getTime() + REMINDER_LEAD_MS) } },
      include: { staff: { select: { id: true, userId: true, isActive: true, hospitalId: true } } },
    });
    const due = (shifts ?? []).filter((shift) => {
      if (!shift.staff?.isActive) return false;
      if (shift.staff.userId) return true;
      logger.warn({ staffId: shift.staff.id, shiftId: shift.id }, '[Reminders] shift reminder skipped: staff has no linked login');
      return false;
    });
    const zones = await hospitalTimezones(due.map((s) => s.staff.hospitalId));
    return await deliver('SHIFT', due.map((shift) => {
      const userId = shift.staff.userId as string;
      const tz = zones.get(shift.staff.hospitalId) ?? 'UTC';
      return {
        userId,
        dedupeKey: shift.id,
        input: {
          type: 'SHIFT',
          title: 'Shift starting soon',
          message: `Your ${shift.type} shift in ${shift.department} starts at ${formatLocal(shift.startTime, tz)}`,
          link: `/staff?shift=${shift.id}`,
          recipients: { userIds: [userId] },
        },
      };
    }));
  } catch (err) {
    logger.error({ err }, '[Reminders] shift reminders failed');
    return 0;
  }
};

export const sendAppointmentReminders = async (now: Date = new Date()): Promise<number> => {
  try {
    const appointments = await prisma.appointment.findMany({
      where: {
        status: { not: 'CANCELLED' },
        scheduledAt: { gt: now, lte: new Date(now.getTime() + REMINDER_LEAD_MS) },
      },
      include: {
        doctor: { select: { id: true, userId: true, hospitalId: true } },
        patient: { select: { name: true } },
      },
    });
    const due = (appointments ?? []).filter((appt) => {
      if (appt.doctor.userId) return true;
      logger.warn({ staffId: appt.doctor.id, appointmentId: appt.id }, '[Reminders] appointment reminder skipped: doctor has no linked login');
      return false;
    });
    const zones = await hospitalTimezones(due.map((a) => a.doctor.hospitalId));
    return await deliver('APPOINTMENT', due.map((appt) => {
      const userId = appt.doctor.userId as string;
      // scheduledAt in the key: a rescheduled appointment is reminded again.
      const dedupeKey = `${appt.id}-${appt.scheduledAt.getTime()}`;
      const tz = zones.get(appt.doctor.hospitalId) ?? 'UTC';
      const patient = appt.patient ? appt.patient.name : 'a patient';
      return {
        userId,
        dedupeKey,
        input: {
          type: 'APPOINTMENT',
          title: 'Appointment starting soon',
          message: `${appt.type} with ${patient} at ${formatLocal(appt.scheduledAt, tz)}`,
          link: `/appointments?reminder=${dedupeKey}`,
          recipients: { userIds: [userId] },
        },
      };
    }));
  } catch (err) {
    logger.error({ err }, '[Reminders] appointment reminders failed');
    return 0;
  }
};

// Old claims are only needed while the item can still be reminded (< 30 min); keep a week for debugging.
const pruneReminderLog = async (now: Date): Promise<void> => {
  try {
    await prisma.reminderLog.deleteMany({ where: { sentAt: { lt: new Date(now.getTime() - LOG_RETENTION_MS) } } });
  } catch (err) {
    logger.error({ err }, '[Reminders] prune failed');
  }
};

export const runReminders = async (now: Date = new Date()) => {
  const shifts = await sendShiftReminders(now);
  const appointments = await sendAppointmentReminders(now);
  await pruneReminderLog(now);
  return { shifts, appointments };
};
