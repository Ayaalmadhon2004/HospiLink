// backend/src/controllers/appointments.controller.ts
import { Request, Response } from 'express';
import prisma from '../config/db';
import { io } from '../server';
import logger from '../config/logger';
import { hospitalIdOf, clinicalRoom } from '../utils/tenant';
import { notify } from '../services/notification.service';
import type { Prisma } from '@prisma/client';

const handleError = (res: Response, error: unknown, message: string) => {
  logger.error({ err: error }, message);
  res.status(500).json({ success: false, message });
};

const describeAppointment = (a: { scheduledAt: Date | string; patient?: { name?: string } | null }) =>
  `${a.patient?.name ?? 'Patient'} on ${new Date(a.scheduledAt).toISOString().slice(0, 16).replace('T', ' ')} UTC`;

// Appointment.doctorId points at Staff; the matching login (User) shares the same email.
const notifyAppointmentDoctor = async (
  appointment: { doctorId: string; scheduledAt: Date | string; patient?: { name?: string } | null },
  title: string,
  actorId?: string
) => {
  try {
    const message = describeAppointment(appointment);
    const doctorStaffId = appointment.doctorId;
    const staff = await prisma.staff.findUnique({ where: { id: doctorStaffId }, select: { email: true } });
    if (!staff) return;
    const user = await prisma.user.findUnique({ where: { email: staff.email }, select: { id: true } });
    if (!user) return;
    await notify({
      type: 'APPOINTMENT',
      title,
      message,
      link: '/appointments',
      recipients: { userIds: [user.id], excludeUserId: actorId, scopeUserId: actorId },
    });
  } catch (error) {
    logger.error({ err: error }, 'Appointment notification failed');
  }
};

// ─── GET /api/appointments ─────────────────────────────────────────────
export const getAppointments = async (req: Request, res: Response) => {
  try {
    const { date, doctorId, patientId, status, type, department } = req.query;

    const where: Prisma.AppointmentWhereInput = { patient: { hospitalId: hospitalIdOf(req) } };

    if (date) {
      const d = new Date(date as string);
      const startOfDay = new Date(d.setHours(0, 0, 0, 0));
      const endOfDay = new Date(d.setHours(23, 59, 59, 999));
      where.scheduledAt = { gte: startOfDay, lte: endOfDay };
    }
    if (doctorId) where.doctorId = doctorId as string;
    if (patientId) where.patientId = patientId as string;
    if (status) where.status = status as string;
    if (type) where.type = type as string;
    if (department) where.department = department as string;

    const appointments = await prisma.appointment.findMany({
      where,
      include: {
        patient: { select: { id: true, name: true, patientCode: true, gender: true, age: true } },
        doctor: { select: { id: true, name: true, role: true, department: true } },
      },
      orderBy: { scheduledAt: 'asc' },
    });

    res.status(200).json({ success: true, count: appointments.length, data: appointments });
  } catch (error: unknown) {
    handleError(res, error, 'Failed to fetch appointments');
  }
};

// ─── GET /api/appointments/today ───────────────────────────────────────
export const getTodaySchedule = async (req: Request, res: Response) => {
  try {
    const now = new Date();
    const startOfDay = new Date(now.setHours(0, 0, 0, 0));
    const endOfDay = new Date(now.setHours(23, 59, 59, 999));

    const appointments = await prisma.appointment.findMany({
      where: {
        patient: { hospitalId: hospitalIdOf(req) },
        scheduledAt: { gte: startOfDay, lte: endOfDay },
        status: { not: 'CANCELLED' },
      },
      include: {
        patient: { select: { id: true, name: true, patientCode: true } },
        doctor: { select: { id: true, name: true, role: true } },
      },
      orderBy: { scheduledAt: 'asc' },
      take: 50,
    });

    // Group by hour for timeline view
    const schedule = appointments.reduce<Record<string, typeof appointments>>((acc, apt) => {
      const hour = new Date(apt.scheduledAt).getHours();
      const timeKey = `${hour.toString().padStart(2, '0')}:00`;
      if (!acc[timeKey]) acc[timeKey] = [];
      acc[timeKey].push(apt);
      return acc;
    }, {});

    res.status(200).json({ success: true, data: { appointments, schedule } });
  } catch (error: unknown) {
    handleError(res, error, 'Failed to fetch today schedule');
  }
};

// ─── GET /api/appointments/upcoming ────────────────────────────────────
export const getUpcomingAppointments = async (req: Request, res: Response) => {
  try {
    const now = new Date();

    const appointments = await prisma.appointment.findMany({
      where: {
        patient: { hospitalId: hospitalIdOf(req) },
        scheduledAt: { gte: now },
        status: { not: 'CANCELLED' },
      },
      include: {
        patient: { select: { id: true, name: true, patientCode: true } },
        doctor: { select: { id: true, name: true, role: true } },
      },
      orderBy: { scheduledAt: 'asc' },
      take: 20,
    });

    res.status(200).json({ success: true, count: appointments.length, data: appointments });
  } catch (error: unknown) {
    handleError(res, error, 'Failed to fetch upcoming appointments');
  }
};

// ─── GET /api/appointments/:id ───────────────────────────────────────
export const getAppointmentById = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;

    const appointment = await prisma.appointment.findFirst({
      where: { id, patient: { hospitalId: hospitalIdOf(req) } },
      include: {
        patient: true,
        doctor: { select: { id: true, name: true, role: true, department: true, phone: true } },
      },
    });

    if (!appointment) {
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }

    res.status(200).json({ success: true, data: appointment });
  } catch (error: unknown) {
    handleError(res, error, 'Failed to fetch appointment');
  }
};

// ─── POST /api/appointments ────────────────────────────────────────────
export const createAppointment = async (req: Request, res: Response) => {
  try {
    const {
      patientId,        // ✅ NEW: Existing patient ID from dropdown
      patientName,
      patientCode,
      doctorId,
      scheduledAt,
      type,
      status,
      department,
      room,
      notes,
      duration,
    } = req.body;

    // The hospital is the caller's, never picked arbitrarily or taken from the body.
    const hospitalId = hospitalIdOf(req);

    // The doctor (Staff) must belong to the same hospital.
    const doctor = await prisma.staff.findFirst({ where: { id: doctorId, hospitalId }, select: { id: true } });
    if (!doctor) {
      return res.status(404).json({ success: false, message: 'Doctor not found' });
    }

    // ✅ PRIORITY 1: Use existing patient by ID (from dropdown)
    let patient = null;
    
    if (patientId) {
      patient = await prisma.patient.findFirst({
        where: { id: patientId, hospitalId },
      });
      if (patient) {
        logger.debug({ patientId: patient.id }, "Found existing patient by ID");
      }
    }

    // ✅ PRIORITY 2: Find by patientCode
    if (!patient && patientCode) {
      patient = await prisma.patient.findFirst({
        where: { patientCode, hospitalId },
      });
      if (patient) {
        logger.debug({ patientId: patient.id }, "Found existing patient by code");
      }
    }

    // ✅ PRIORITY 3: Create new patient ONLY if not found
    if (!patient) {
      if (!patientName) {
        return res.status(400).json({
          success: false,
          message: 'Patient name is required when creating a new patient',
        });
      }

      patient = await prisma.patient.create({
        data: {
          name: patientName,
          patientCode: patientCode || `PT-${Date.now()}`,
          department: department || 'General',
          age: 0,
          gender: 'MALE',
          diagnosis: 'Pending',
          hospitalId,
        },
      });
      logger.debug({ patientId: patient.id }, "Created new patient");
    }

    // ✅ Check for conflicts
    const appointmentStart = new Date(scheduledAt);
    const appointmentEnd = new Date(appointmentStart.getTime() + (duration || 30) * 60000);

    const conflict = await prisma.appointment.findFirst({
      where: {
        doctorId,
        status: { not: 'CANCELLED' },
        scheduledAt: { lt: appointmentEnd },
        AND: {
          scheduledAt: {
            gt: new Date(appointmentStart.getTime() - (duration || 30) * 60000),
          },
        },
      },
    });

    if (conflict) {
      return res.status(409).json({
        success: false,
        message: 'Doctor has a conflicting appointment at this time',
      });
    }

    const appointment = await prisma.appointment.create({
      data: {
        patientId: patient.id,
        doctorId,
        scheduledAt: appointmentStart,
        type,
        status: status || 'SCHEDULED',
        department,
        room,
        notes,
        duration: duration || 30,
      },
      include: {
        patient: { select: { id: true, name: true, patientCode: true } },
        doctor: { select: { id: true, name: true, role: true } },
      },
    });

    io.to(clinicalRoom(hospitalIdOf(req))).emit('appointment-created', appointment);

    await notifyAppointmentDoctor(appointment, 'New appointment', req.user?.id);

    res.status(201).json({ success: true, data: appointment });
  } catch (error: unknown) {
    handleError(res, error, 'Failed to create appointment');
  }
};

// ─── PUT /api/appointments/:id ───────────────────────────────────────
export const updateAppointment = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const updateData = req.body;
    const hospitalId = hospitalIdOf(req);

    const existing = await prisma.appointment.findFirst({
      where: { id, patient: { hospitalId } },
      select: { id: true },
    });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }
    if (updateData.patientId && !(await prisma.patient.findFirst({ where: { id: updateData.patientId, hospitalId }, select: { id: true } }))) {
      return res.status(404).json({ success: false, message: 'Patient not found' });
    }
    if (updateData.doctorId && !(await prisma.staff.findFirst({ where: { id: updateData.doctorId, hospitalId }, select: { id: true } }))) {
      return res.status(404).json({ success: false, message: 'Doctor not found' });
    }

    if (updateData.scheduledAt) {
      updateData.scheduledAt = new Date(updateData.scheduledAt);
    }

    const appointment = await prisma.appointment.update({
      where: { id },
      data: updateData,
      include: {
        patient: { select: { id: true, name: true } },
        doctor: { select: { id: true, name: true } },
      },
    });

    io.to(clinicalRoom(hospitalIdOf(req))).emit('appointment-updated', appointment);

    // Only schedule-relevant changes are worth a notification.
    if (['scheduledAt', 'status', 'doctorId', 'room'].some((k) => k in updateData)) {
      await notifyAppointmentDoctor(appointment, 'Appointment changed', req.user?.id);
    }

    res.status(200).json({ success: true, data: appointment });
  } catch (error: unknown) {
    handleError(res, error, 'Failed to update appointment');
  }
};

// ─── DELETE /api/appointments/:id ────────────────────────────────────
export const deleteAppointment = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;

    const existing = await prisma.appointment.findFirst({
      where: { id, patient: { hospitalId: hospitalIdOf(req) } },
      select: { id: true },
    });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }

    const appointment = await prisma.appointment.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });

    io.to(clinicalRoom(hospitalIdOf(req))).emit('appointment-cancelled', { id });

    await notifyAppointmentDoctor(appointment, 'Appointment cancelled', req.user?.id);

    res.status(200).json({ success: true, message: 'Appointment cancelled', data: appointment });
  } catch (error: unknown) {
    handleError(res, error, 'Failed to cancel appointment');
  }
};