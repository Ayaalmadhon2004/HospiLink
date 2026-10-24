// backend/src/validators/appointment.validator.ts
import { z } from 'zod';
import { idSchema, nonEmpty, dateString } from './common.validator';

const duration = z.number().int().min(1).max(1440);

// An appointment always points at an EXISTING patient (admit the patient first). patientName is no longer
// accepted: zod strips it, so clients cannot create patients with invented medical data through this route.
export const createAppointmentSchema = z.object({
  patientId: idSchema.optional(),
  patientCode: z.string().trim().min(1).max(50).optional(),
  doctorId: idSchema,
  scheduledAt: dateString('scheduledAt'),
  type: nonEmpty('type', 50),
  status: nonEmpty('status', 30).optional(),
  department: z.string().trim().max(100).optional(),
  room: z.string().trim().max(50).optional(),
  notes: z.string().trim().max(2000).optional(),
  duration: duration.optional(),
}).refine((v) => Boolean(v.patientId || v.patientCode), {
  message: 'patientId or patientCode is required',
  path: ['patientId'],
});

// Update accepts only real Appointment columns; patientName/patientCode sent by the
// edit modal are stripped (they are not columns on Appointment).
export const updateAppointmentSchema = z.object({
  patientId: idSchema.optional(),
  doctorId: idSchema.optional(),
  scheduledAt: dateString('scheduledAt').optional(),
  type: nonEmpty('type', 50).optional(),
  status: nonEmpty('status', 30).optional(),
  department: z.string().trim().max(100).optional(),
  room: z.string().trim().max(50).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  duration: duration.optional(),
});

export const appointmentQuerySchema = z.object({
  date: dateString('date').optional(),
  doctorId: z.string().trim().min(1).optional(),
  patientId: z.string().trim().min(1).optional(),
  status: z.string().trim().min(1).max(30).optional(),
  type: z.string().trim().min(1).max(50).optional(),
  department: z.string().trim().min(1).max(100).optional(),
});
