// backend/src/controllers/incidents.controller.ts
import { Request, Response } from 'express';
import prisma from '../config/db';
import { getIO } from '../utils/socket';
import { hospitalIdOf, clinicalRoom } from '../utils/tenant';
import { notify } from '../services/notification.service';
import logger from '../config/logger';
import type { Prisma, IncidentStatus, IncidentSeverity, IncidentType } from '@prisma/client';

const handleError = (res: Response, error: unknown, message: string) => {
  logger.error({ err: error }, message);
  res.status(500).json({ success: false, message });
};

// Who hears about incidents: admins and clinical staff, never the actor.
const incidentRecipients = (hospitalId: string, actorId?: string) => ({
  hospitalId,
  roles: ['ADMIN', 'DOCTOR', 'NURSE'] as Array<'ADMIN' | 'DOCTOR' | 'NURSE'>,
  excludeUserId: actorId,
});

const SEVERITY_RANK: Record<string, number> = { LOW: 0, MODERATE: 1, ELEVATED: 2, CRITICAL: 3 };
const isEscalation = (from?: string | null, to?: string | null) =>
  !!from && !!to && (SEVERITY_RANK[to] ?? -1) > (SEVERITY_RANK[from] ?? -1);

const notifyResolved = (incident: { code: string }, hospitalId: string, actorId?: string) =>
  notify({
    type: 'INCIDENT',
    title: 'Incident Resolved',
    message: `${incident.code} has been marked as resolved`,
    link: '/incidents',
    recipients: incidentRecipients(hospitalId, actorId),
  });

// Codes are unique per hospital (@@unique([hospitalId, code])).
const generateIncidentCode = async (hospitalId: string) => {
  const count = await prisma.incident.count({ where: { hospitalId } });
  return `INC-${String(count + 91).padStart(4, '0')}`;
};

// GET /api/incidents
export const getIncidents = async (req: Request, res: Response) => {
  try {
    const { status, severity, type } = req.query;
    const where: Prisma.IncidentWhereInput = { hospitalId: hospitalIdOf(req) };

    if (status && status !== '') where.status = status as IncidentStatus;
    if (severity && severity !== '') where.severity = severity as IncidentSeverity;
    if (type && type !== '') where.type = type as IncidentType;

    const incidents = await prisma.incident.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    res.status(200).json({ success: true, count: incidents.length, data: incidents });
  } catch (error: unknown) {
    handleError(res, error, 'Failed to fetch incidents');
  }
};

// GET /api/incidents/active
export const getActiveIncidents = async (req: Request, res: Response) => {
  try {
    const incidents = await prisma.incident.findMany({
      where: { status: 'ACTIVE', hospitalId: hospitalIdOf(req) },
      orderBy: [
        { severity: 'asc' },
        { createdAt: 'desc' },
      ],
      take: 50,
    });

    const critical = incidents.filter((i) => i.severity === 'CRITICAL');
    const elevated = incidents.filter((i) => i.severity === 'ELEVATED');
    const moderate = incidents.filter((i) => i.severity === 'MODERATE');

    res.status(200).json({
      success: true,
      data: {
        all: incidents,
        critical,
        elevated,
        moderate,
        total: incidents.length,
      },
    });
  } catch (error: unknown) {
    handleError(res, error, 'Failed to fetch active incidents');
  }
};

// GET /api/incidents/:id
export const getIncidentById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params as { id: string };
    const incident = await prisma.incident.findFirst({ where: { id, hospitalId: hospitalIdOf(req) } });

    if (!incident) {
      return res.status(404).json({ success: false, message: 'Incident not found' });
    }

    res.status(200).json({ success: true, data: incident });
  } catch (error: unknown) {
    handleError(res, error, 'Failed to fetch incident');
  }
};

// POST /api/incidents
export const createIncident = async (req: Request, res: Response) => {
  try {
    const { title, type, severity, location, reportedBy, description } = req.body;

    const hospitalId = hospitalIdOf(req);
    const code = await generateIncidentCode(hospitalId);

    const incident = await prisma.incident.create({
      data: {
        code,
        title,
        description,
        type,
        severity,
        location,
        reportedBy,
        progress: 0,
        hospitalId,
      },
    });

    getIO().to(clinicalRoom(hospitalId)).emit('incident-created', incident);

    await notify({
      type: 'INCIDENT',
      title: 'New Incident Reported',
      message: `${incident.code}: ${incident.title}`,
      link: '/incidents',
      recipients: incidentRecipients(hospitalId, req.user?.id),
    });

    res.status(201).json({ success: true, data: incident });
  } catch (error: unknown) {
    handleError(res, error, 'Failed to create incident');
  }
};

// PUT /api/incidents/:id
export const updateIncident = async (req: Request, res: Response) => {
  try {
    const { id } = req.params as { id: string };
    const updateData = req.body;

    if (updateData.status === 'RESOLVED' && !updateData.resolvedAt) {
      updateData.resolvedAt = new Date();
    }

    if (updateData.patientId === '') updateData.patientId = null;
    if (updateData.actionTaken === '') updateData.actionTaken = null;

    const hospitalId = hospitalIdOf(req);
    const previous = await prisma.incident.findFirst({ where: { id, hospitalId }, select: { severity: true, status: true } });
    if (!previous) {
      return res.status(404).json({ success: false, message: 'Incident not found' });
    }

    const incident = await prisma.incident.update({
      where: { id },
      data: updateData,
    });

    getIO().to(clinicalRoom(hospitalId)).emit('incident-updated', incident);

    if (isEscalation(previous?.severity, incident.severity)) {
      await notify({
        type: 'INCIDENT',
        title: 'Incident Escalated',
        message: `${incident.code} escalated from ${previous?.severity} to ${incident.severity}`,
        link: '/incidents',
        recipients: incidentRecipients(hospitalId, req.user?.id),
      });
    }
    if (previous && previous.status !== 'RESOLVED' && incident.status === 'RESOLVED') {
      await notifyResolved(incident, hospitalId, req.user?.id);
    }
    res.status(200).json({ success: true, data: incident });
  } catch (error: unknown) {
    handleError(res, error, 'Failed to update incident');
  }
};

// PUT /api/incidents/:id/status
export const updateIncidentStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params as { id: string };
    const { status, progress } = req.body;
    const hospitalId = hospitalIdOf(req);

    const existing = await prisma.incident.findFirst({ where: { id, hospitalId }, select: { id: true } });
    if (!existing) return res.status(404).json({ success: false, message: 'Incident not found' });

    const updateData: Prisma.IncidentUpdateInput = { status };
    if (progress !== undefined) updateData.progress = progress;
    if (status === 'RESOLVED') updateData.resolvedAt = new Date();

    const incident = await prisma.incident.update({
      where: { id },
      data: updateData,
    });

    getIO().to(clinicalRoom(hospitalId)).emit('incident-status-updated', incident);

    // Notify when incident is resolved
    if (status === 'RESOLVED') {
      await notifyResolved(incident, hospitalId, req.user?.id);
    }

    res.status(200).json({ success: true, data: incident });
  } catch (error: unknown) {
    handleError(res, error, 'Failed to update incident status');
  }
};

// DELETE /api/incidents/:id
export const deleteIncident = async (req: Request, res: Response) => {
  try {
    const { id } = req.params as { id: string };

    const hospitalId = hospitalIdOf(req);

    const existing = await prisma.incident.findFirst({ where: { id, hospitalId }, select: { id: true } });
    if (!existing) return res.status(404).json({ success: false, message: 'Incident not found' });

    await prisma.incident.delete({ where: { id } });

    getIO().to(clinicalRoom(hospitalId)).emit('incident-deleted', { id });
    res.status(200).json({ success: true, message: 'Incident deleted successfully' });
  } catch (error: unknown) {
    handleError(res, error, 'Failed to delete incident');
  }
};