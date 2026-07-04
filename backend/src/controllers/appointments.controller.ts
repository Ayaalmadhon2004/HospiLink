// backend/src/controllers/appointments.controller.ts
import { Request, Response } from 'express';
import prisma from '../config/db';
import { io } from '../server';

const handleError = (res: Response, error: any, message: string) => {
  console.error(message, error);
  res.status(500).json({ success: false, message, error: error.message });
};

// ─── GET /api/appointments ─────────────────────────────────────────────
export const getAppointments = async (req: Request, res: Response) => {
  try {
    const { date, doctorId, patientId, status, type, department } = req.query;

    const where: any = {};
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
  } catch (error: any) {
    handleError(res, error, 'Failed to fetch appointments');
  }
};

// ─── GET /api/appointments/today ───────────────────────────────────────
export const getTodaySchedule = async (req: Request, res: Response) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);

    const appointments = await prisma.appointment.findMany({
      where: {
        scheduledAt: { gte: today, lte: endOfDay },
        status: { not: 'CANCELLED' },
      },
      include: {
        patient: { select: { id: true, name: true, patientCode: true } },
        doctor: { select: { id: true, name: true, role: true } },
      },
      orderBy: { scheduledAt: 'asc' },
    });

    // Group by hour for timeline view
    const schedule = appointments.reduce((acc: any, apt: any) => {
      const hour = new Date(apt.scheduledAt).getHours();
      const timeKey = `${hour.toString().padStart(2, '0')}:00`;
      if (!acc[timeKey]) acc[timeKey] = [];
      acc[timeKey].push(apt);
      return acc;
    }, {});

    res.status(200).json({ success: true, data: { appointments, schedule } });
  } catch (error: any) {
    handleError(res, error, 'Failed to fetch today schedule');
  }
};

// ─── GET /api/appointments/upcoming ────────────────────────────────────
export const getUpcomingAppointments = async (req: Request, res: Response) => {
  try {
    const now = new Date();

    const appointments = await prisma.appointment.findMany({
      where: {
        scheduledAt: { gte: now },
        status: { not: 'CANCELLED' },
      },
      include: {
        patient: { select: { id: true, name: true, patientCode: true } },
        doctor: { select: { id: true, name: true, role: true } },
      },
      orderBy: { scheduledAt: 'asc' },
      take: 20, // limit to next 20
    });

    res.status(200).json({ success: true, count: appointments.length, data: appointments });
  } catch (error: any) {
    handleError(res, error, 'Failed to fetch upcoming appointments');
  }
};

// ─── GET /api/appointments/:id ───────────────────────────────────────
export const getAppointmentById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const appointment = await prisma.appointment.findUnique({
      where: { id },
      include: {
        patient: true,
        doctor: { select: { id: true, name: true, role: true, department: true, phone: true } },
      },
    });

    if (!appointment) {
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }

    res.status(200).json({ success: true, data: appointment });
  } catch (error: any) {
    handleError(res, error, 'Failed to fetch appointment');
  }
};

// ─── POST /api/appointments ────────────────────────────────────────────
export const createAppointment = async (req: Request, res: Response) => {
  try {
    const {
      patientId,
      doctorId,
      scheduledAt,
      type,
      status,
      department,
      room,
      notes,
      duration, // in minutes
    } = req.body;

    // Check for conflicts
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
        patientId,
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

    // Emit real-time update
    io.emit('appointment-created', appointment);

    res.status(201).json({ success: true, data: appointment });
  } catch (error: any) {
    handleError(res, error, 'Failed to create appointment');
  }
};

// ─── PUT /api/appointments/:id ───────────────────────────────────────
export const updateAppointment = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

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

    io.emit('appointment-updated', appointment);

    res.status(200).json({ success: true, data: appointment });
  } catch (error: any) {
    handleError(res, error, 'Failed to update appointment');
  }
};

// ─── DELETE /api/appointments/:id ────────────────────────────────────
export const deleteAppointment = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Soft delete: update status to CANCELLED
    const appointment = await prisma.appointment.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });

    io.emit('appointment-cancelled', { id });

    res.status(200).json({ success: true, message: 'Appointment cancelled', data: appointment });
  } catch (error: any) {
    handleError(res, error, 'Failed to cancel appointment');
  }
};