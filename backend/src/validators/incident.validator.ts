// backend/src/validators/incident.validator.ts
import { z } from 'zod';
import { nonEmpty, dateString } from './common.validator';

// Incident.type / severity are free strings in prisma; the UI offers fixed lists
// but other values may exist in the DB, so they are only length-checked.
export const incidentStatusEnum = z.enum(['ACTIVE', 'RESOLVED', 'PENDING']);

export const createIncidentSchema = z.object({
  title: nonEmpty('title', 200),
  type: nonEmpty('type', 50),
  severity: nonEmpty('severity', 50),
  location: nonEmpty('location', 200),
  reportedBy: nonEmpty('reportedBy', 100),
  description: z.string().trim().max(5000).optional(),
});

export const updateIncidentSchema = z.object({
  title: nonEmpty('title', 200).optional(),
  type: nonEmpty('type', 50).optional(),
  severity: nonEmpty('severity', 50).optional(),
  location: nonEmpty('location', 200).optional(),
  reportedBy: nonEmpty('reportedBy', 100).optional(),
  description: z.string().trim().max(5000).nullable().optional(),
  status: incidentStatusEnum.optional(),
  teams: z.number().int().min(0).max(1000).optional(),
  progress: z.number().int().min(0).max(100).optional(),
  triageLevel: z.string().trim().max(50).nullable().optional(),
  resolvedAt: dateString('resolvedAt').optional(),
});

export const updateIncidentStatusSchema = z.object({
  status: incidentStatusEnum,
  progress: z.number().int().min(0).max(100).optional(),
});

export const incidentQuerySchema = z.object({
  status: z.string().trim().max(30).optional(),
  severity: z.string().trim().max(50).optional(),
  type: z.string().trim().max(50).optional(),
});
