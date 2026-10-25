import { Request, Response } from 'express';
import type { Prisma } from '@prisma/client';
import prisma from '../config/db';
import logger from '../config/logger';
import { hospitalIdOf } from '../utils/tenant';
import { pageParams, pageInfo } from '../utils/pagination';
import { ok, fail } from '../utils/apiResponse';

const DEFAULT_AUDIT_PAGE = 50;

const str = (v: unknown): string | undefined => (typeof v === 'string' && v !== '' ? v : undefined);

// GET /api/audit-logs (ADMIN) - newest first. `from` is inclusive, `to` is exclusive (half-open range, like the day ranges).
export const listAuditLogs = async (req: Request, res: Response) => {
  try {
    const q = req.query as Record<string, unknown>;
    const where: Prisma.AuditLogWhereInput = { hospitalId: hospitalIdOf(req) };
    if (str(q.action)) where.action = str(q.action);
    if (str(q.userId)) where.userId = str(q.userId);
    if (str(q.entityId)) where.entityId = str(q.entityId);
    const from = str(q.from);
    const to = str(q.to);
    if (from || to) where.createdAt = { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lt: new Date(to) } : {}) };

    const page = pageParams(req.query, DEFAULT_AUDIT_PAGE);
    const [rows, totalCount] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        select: {
          id: true, action: true, entityId: true, details: true, createdAt: true,
          user: { select: { id: true, name: true, email: true, role: true } },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: page.skip,
        take: page.take,
      }),
      prisma.auditLog.count({ where }),
    ]);
    return ok(res, rows, { count: rows.length, pagination: pageInfo(page, totalCount) });
  } catch (error: unknown) {
    logger.error({ err: error }, 'List audit logs error:');
    return fail(res, 500, 'INTERNAL_ERROR', 'Failed to load audit logs');
  }
};

// GET /api/audit-logs/actions (ADMIN) - distinct action names of this hospital, for the filter dropdown.
export const listAuditActions = async (req: Request, res: Response) => {
  try {
    const rows = await prisma.auditLog.findMany({
      where: { hospitalId: hospitalIdOf(req) },
      distinct: ['action'],
      select: { action: true },
      orderBy: { action: 'asc' },
    });
    return ok(res, rows.map((r) => r.action));
  } catch (error: unknown) {
    logger.error({ err: error }, 'List audit actions error:');
    return fail(res, 500, 'INTERNAL_ERROR', 'Failed to load audit actions');
  }
};
