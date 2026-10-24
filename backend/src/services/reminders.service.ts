// backend/src/services/reminders.service.ts
//
// Time-based reminders built on `notify()`: shifts and appointments starting within the
// next 30 minutes. Recipients come from Staff.userId (an explicit link; staff without one are logged and skipped). Idempotent: a reminder is skipped when the user already has a
// Notification with the same type + link (the link carries the shift/appointment id).
// Tolerant of Render sleeping: every run looks at "starts in (now, now + 30 min]", so a late
// run still reminds as long as the item has not started. Never throws.
import prisma from '../config/db';
import logger from '../config/logger';
import { notify, type NotificationType } from './notification.service';

export const REMINDER_LEAD_MS = 30 * 60 * 1000;

const alreadySent = async (userId: string, type: NotificationType, link: string): Promise<boolean> => {
  const existing = await prisma.notification.findFirst({ where: { userId, type, link }, select: { id: true } });
  return !!existing;
};

const fmt = (d: Date) => d.toISOString().slice(11, 16) + ' UTC';

export const sendShiftReminders = async (now: Date = new Date()): Promise<number> => {
  let sent = 0;
  try {
    const shifts = await prisma.shift.findMany({
      where: { startTime: { gt: now, lte: new Date(now.getTime() + REMINDER_LEAD_MS) } },
      include: { staff: { select: { id: true, userId: true, isActive: true } } },
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
        if (await alreadySent(userId, 'SHIFT', link)) continue;
        const res = await notify({
          type: 'SHIFT',
          title: 'Shift starting soon',
          message: `Your ${shift.type} shift in ${shift.department} starts at ${fmt(shift.startTime)}`,
          link,
          recipients: { userIds: [userId] },
        });
        sent += res.length;
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
  try {
    const appointments = await prisma.appointment.findMany({
      where: {
        status: { not: 'CANCELLED' },
        scheduledAt: { gt: now, lte: new Date(now.getTime() + REMINDER_LEAD_MS) },
      },
      include: {
        doctor: { select: { id: true, userId: true } },
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
        const link = `/appointments?reminder=${appt.id}-${appt.scheduledAt.getTime()}`;
        if (await alreadySent(userId, 'APPOINTMENT', link)) continue;
        const patient = appt.patient ? appt.patient.name : 'a patient';
        const res = await notify({
          type: 'APPOINTMENT',
          title: 'Appointment starting soon',
          message: `${appt.type} with ${patient} at ${fmt(appt.scheduledAt)}`,
          link,
          recipients: { userIds: [userId] },
        });
        sent += res.length;
      } catch (err) {
        logger.error({ err, appointmentId: appt.id }, '[Reminders] appointment reminder failed');
      }
    }
  } catch (err) {
    logger.error({ err }, '[Reminders] appointment reminders failed');
  }
  return sent;
};

export const runReminders = async (now: Date = new Date()) => ({
  shifts: await sendShiftReminders(now),
  appointments: await sendAppointmentReminders(now),
});
