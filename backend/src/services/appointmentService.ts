// backend/src/services/appointmentService.ts
// Appointment notification + query-building helpers (extracted from appointments.controller).
import prisma from '../config/db';
import logger from '../config/logger';
import { dayRange, hospitalTimezone, hourKey, formatLocal } from '../utils/time';
import { notify } from './notification.service';
import type { Prisma, AppointmentStatus, AppointmentType } from '@prisma/client';

export interface AppointmentFilters {
  date?: unknown;
  doctorId?: unknown;
  patientId?: unknown;
  status?: unknown;
  type?: unknown;
  department?: unknown;
}

export const buildAppointmentWhere = async (hospitalId: string, q: AppointmentFilters): Promise<Prisma.AppointmentWhereInput> => {
  const where: Prisma.AppointmentWhereInput = { patient: { hospitalId, deletedAt: null } };

  if (q.date) {
    const { start, end } = dayRange(await hospitalTimezone(hospitalId), q.date as string);
    where.scheduledAt = { gte: start, lt: end };
  }
  if (q.doctorId) where.doctorId = q.doctorId as string;
  if (q.patientId) where.patientId = q.patientId as string;
  if (q.status) where.status = q.status as AppointmentStatus;
  if (q.type) where.type = q.type as AppointmentType;
  if (q.department) where.department = q.department as string;
  return where;
};

// Group appointments by hour (in the hospital timezone) for the timeline view.
export const groupByHour = <T extends { scheduledAt: Date }>(appointments: T[], tz: string): Record<string, T[]> =>
  appointments.reduce<Record<string, T[]>>((acc, apt) => {
    const timeKey = hourKey(apt.scheduledAt, tz);
    if (!acc[timeKey]) acc[timeKey] = [];
    acc[timeKey].push(apt);
    return acc;
  }, {});

const describeAppointment = (a: { scheduledAt: Date | string; patient?: { name?: string } | null }, tz: string) =>
  `${a.patient?.name ?? 'Patient'} on ${formatLocal(a.scheduledAt, tz)}`;

// Appointment.doctorId points at Staff; its login is Staff.userId (an explicit link, not an email match).
export const notifyAppointmentDoctor = async (
  appointment: { doctorId: string; scheduledAt: Date | string; patient?: { name?: string } | null },
  title: string,
  hospitalId: string,
  actorId?: string
) => {
  try {
    const message = describeAppointment(appointment, await hospitalTimezone(hospitalId));
    const doctorStaffId = appointment.doctorId;
    const staff = await prisma.staff.findUnique({ where: { id: doctorStaffId }, select: { userId: true } });
    if (!staff) return;
    if (!staff.userId) {
      // Not silent: an admin can link or create the login from the staff directory.
      logger.warn({ staffId: doctorStaffId }, 'Appointment notification skipped: staff member has no linked login');
      return;
    }
    await notify({
      type: 'APPOINTMENT',
      title,
      message,
      link: '/appointments',
      recipients: { userIds: [staff.userId], excludeUserId: actorId, scopeUserId: actorId },
    });
  } catch (error) {
    logger.error({ err: error }, 'Appointment notification failed');
  }
};
