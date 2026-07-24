// backend/src/controllers/incidents.controller.ts
import { Request, Response } from 'express';
import prisma from '../config/db';
import { io } from '../server';

const handleError = (res: Response, error: any, message: string) => {
  console.error(message, error);
  res.status(500).json({ success: false, message, error: error.message });
};

const generateIncidentCode = async () => {
  const count = await prisma.incident.count();
  return `INC-${String(count + 91).padStart(4, '0')}`;
};

// GET /api/incidents
export const getIncidents = async (req: Request, res: Response) => {
  try {
    const { status, severity, type } = req.query;
    const where: any = {};

    if (status && status !== '') where.status = status as string;
    if (severity && severity !== '') where.severity = severity as string;
    if (type && type !== '') where.type = type as string;

    const incidents = await prisma.incident.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    res.status(200).json({ success: true, count: incidents.length, data: incidents });
  } catch (error: any) {
    handleError(res, error, 'Failed to fetch incidents');
  }
};

// GET /api/incidents/active
export const getActiveIncidents = async (req: Request, res: Response) => {
  try {
    const incidents = await prisma.incident.findMany({
      where: { status: 'ACTIVE' },
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
  } catch (error: any) {
    handleError(res, error, 'Failed to fetch active incidents');
  }
};

// GET /api/incidents/:id
export const getIncidentById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params as { id: string };
    const incident = await prisma.incident.findUnique({ where: { id } });

    if (!incident) {
      return res.status(404).json({ success: false, message: 'Incident not found' });
    }

    res.status(200).json({ success: true, data: incident });
  } catch (error: any) {
    handleError(res, error, 'Failed to fetch incident');
  }
};

// POST /api/incidents
export const createIncident = async (req: Request, res: Response) => {
  try {
    const { title, type, severity, location, reportedBy, description } = req.body;

    const code = await generateIncidentCode();

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
      },
    });

    io.emit('incident-created', incident);
    res.status(201).json({ success: true, data: incident });
  } catch (error: any) {
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

    const incident = await prisma.incident.update({
      where: { id },
      data: updateData,
    });

    io.emit('incident-updated', incident);
    res.status(200).json({ success: true, data: incident });
  } catch (error: any) {
    handleError(res, error, 'Failed to update incident');
  }
};

// PUT /api/incidents/:id/status
export const updateIncidentStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params as { id: string };
    const { status, progress } = req.body;

    const updateData: any = { status };
    if (progress !== undefined) updateData.progress = progress;
    if (status === 'RESOLVED') updateData.resolvedAt = new Date();

    const incident = await prisma.incident.update({
      where: { id },
      data: updateData,
    });

    io.emit('incident-status-updated', incident);
    res.status(200).json({ success: true, data: incident });
  } catch (error: any) {
    handleError(res, error, 'Failed to update incident status');
  }
};

// ✅ NEW: DELETE /api/incidents/:id
export const deleteIncident = async (req: Request, res: Response) => {
  try {
    const { id } = req.params as { id: string };

    await prisma.incident.delete({ where: { id } });

    io.emit('incident-deleted', { id });
    res.status(200).json({ success: true, message: 'Incident deleted successfully' });
  } catch (error: any) {
    handleError(res, error, 'Failed to delete incident');
  }
};