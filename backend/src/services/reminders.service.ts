// backend/src/services/reminders.service.ts
//
// Time-based reminders built on `notify()`: shifts and appointments starting within the
// next 30 minutes. Recipients come from Staff.userId (an explicit link; staff without one are
// logged and skipped). Triggered from outside the web process (POST /api/internal/run-reminders,
// see docs/NOTIFICATIONS.md), so it works with several instances and with Render sleeping.
// Idempotent and race-free: a reminder is claimed through the unique key of ReminderLog
// (INSERT ... ON CONFLICT DO NOTHING); only the caller that inserts the row sends it. If nothing
// was delivered (setting off, notify failed) the claim is released so a later run can retry
// until the item starts. Times are formatted in the hospital's time zone. Never throws.
import prisma from '../config/db';
import logger from '../config/logger';
import { notify } from './notification.service';
import { formatLocal, hospitalTimezone } from '../utils/time';

export const REMINDER_LEAD_MS = 30 * 60 * 1000;
const LOG_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

type Kind = 'SHIFT' | 'APPOINTMENT';

const claim = async (userId: string, kind: Kind, dedupeKey: string): Promise<boolean> => {
  const res = await prisma.reminderLog.createMany({ data: [{ userId, kind, dedupeKey }], skipDuplicates: true });
  return res.count === 1;
};

const release = async (userId: string, kind: Kind, dedupeKey: string): Promise<void> => {
  try {
    await prisma.reminderLog.deleteMany({ where: { userId, kind, dedupeKey } });
  } catch (err) {
    logger.error({ err, userId, kind, dedupeKey }, '[Reminders] failed to release claim');
  }
};

// One lookup per hospital per run.
const tzCache = () => {
  const cache = new Map<string, Promise<string>>();
  return (hospitalId: string) => {
    let tz = cache.get(hospitalId);
    if (!tz) cache.set(hospitalId, (tz = hospitalTimezone(hospitalId)));
    return tz;
  };
};

type Reminder = Parameters<typeof notify>[0];

// Claim -> notify -> release the claim when nothing was delivered or notify threw. Returns recipients notified.
const sendOnce = async (userId: string, kind: Kind, dedupeKey: string, input: Reminder): Promise<number> => {
  if (!(await claim(userId, kind, dedupeKey))) return 0;
  try {
    const res = await notify(input);
    if (res.length === 0) await release(userId, kind, dedupeKey);
    return res.length;
  } catch (err) {
    await release(userId, kind, dedupeKey);
    throw err;
  }
};

export const sendShiftReminders = async (now: Date = new Date()): Promise<number> => {
  let sent = 0;
  const tzOf = tzCache();
  try {
    const shifts = await prisma.shift.findMany({
      where: { startTime: { gt: now, lte: new Date(now.getTime() + REMINDER_LEAD_MS) } },
      include: { staff: { select: { id: true, userId: true, isActive: true, hospitalId: true } } },
    });
    for (const shift of shifts ?? []) {
      try {
        if (!shift.staff?.isActive) continue;
        const userId = shift.staff.userId;
        if (!userId) {
          logger.warn({ staffId: shift.staff.id, shiftId: shift.id }, '[Reminders] shift reminder skipped: staff has no linked login');
          continue;
        }
        const link = `/staff?shift=${shift.id}`;
        const tz = await tzOf(shift.staff.hospitalId);
        sent += await sendOnce(userId, 'SHIFT', shift.id, {
          type: 'SHIFT',
          title: 'Shift starting soon',
          message: `Your ${shift.type} shift in ${shift.department} starts at ${formatLocal(shift.startTime, tz)}`,
          link,
          recipients: { userIds: [userId] },
        });
      } catch (err) {
        logger.error({ err, shiftId: shift.id }, '[Reminders] shift reminder failed');
      }
    }
  } catch (err) {
    logger.error({ err }, '[Reminders] shift reminders failed');
  }
  return sent;
};

export const sendAppointmentReminders = async (now: Date = new Date()): Promise<number> => {
  let sent = 0;
  const tzOf = tzCache();
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
    for (const appt of appointments ?? []) {
      try {
        const userId = appt.doctor.userId;
        if (!userId) {
          logger.warn({ staffId: appt.doctor.id, appointmentId: appt.id }, '[Reminders] appointment reminder skipped: doctor has no linked login');
          continue;
        }
        // scheduledAt in the link: a rescheduled appointment is reminded again.
        const dedupeKey = `${appt.id}-${appt.scheduledAt.getTime()}`;
        const tz = await tzOf(appt.doctor.hospitalId);
        const patient = appt.patient ? appt.patient.name : 'a patient';
        sent += await sendOnce(userId, 'APPOINTMENT', dedupeKey, {
          type: 'APPOINTMENT',
          title: 'Appointment starting soon',
          message: `${appt.type} with ${patient} at ${formatLocal(appt.scheduledAt, tz)}`,
          link: `/appointments?reminder=${dedupeKey}`,
          recipients: { userIds: [userId] },
        });
      } catch (err) {
        logger.error({ err, appointmentId: appt.id }, '[Reminders] appointment reminder failed');
      }
    }
  } catch (err) {
    logger.error({ err }, '[Reminders] appointment reminders failed');
  }
  return sent;
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
