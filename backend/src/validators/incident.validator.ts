// backend/src/validators/incident.validator.ts
import { z } from 'zod';
import { IncidentSeverity, IncidentStatus, IncidentType } from '@prisma/client';
import { nonEmpty, dateString, enumValue } from './common.validator';

export const incidentStatusEnum = enumValue(IncidentStatus, 'status');

export const createIncidentSchema = z.object({
  title: nonEmpty('title', 200),
  type: enumValue(IncidentType, 'type'),
  severity: enumValue(IncidentSeverity, 'severity'),
  location: nonEmpty('location', 200),
  reportedBy: nonEmpty('reportedBy', 100),
  description: z.string().trim().max(5000).optional(),
});

export const updateIncidentSchema = z.object({
  title: nonEmpty('title', 200).optional(),
  type: enumValue(IncidentType, 'type').optional(),
  severity: enumValue(IncidentSeverity, 'severity').optional(),
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
  status: enumValue(IncidentStatus, 'status').optional(),
  severity: enumValue(IncidentSeverity, 'severity').optional(),
  type: enumValue(IncidentType, 'type').optional(),
});
