// backend/src/services/patientQueries.ts
// Read-side helpers for patients (extracted from patient.controller).
import prisma from '../config/db';
import type { PatientStatus, Prisma } from '@prisma/client';

const DAY_MS = 24 * 60 * 60 * 1000;
const utcDay = (d: Date): string => d.toISOString().slice(0, 10);

export interface FlowDay {
  date: string;
  admissions: number;
  discharges: number;
}

// Daily admissions and discharges (UTC days, today included), oldest first.
export const getPatientFlowData = async (hospitalId: string, days: number): Promise<FlowDay[]> => {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - (days - 1) * DAY_MS);

  // Aggregated in the DB (one row per UTC day) instead of loading every patient into memory.
  type DayCount = { d: string; c: number };
  const [admitted, discharged] = await Promise.all([
    prisma.$queryRaw<DayCount[]>`
      SELECT to_char("admissionDate" AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS d, COUNT(*)::int AS c
      FROM "Patient" WHERE "hospitalId" = ${hospitalId} AND "deletedAt" IS NULL AND "admissionDate" >= ${start}
      GROUP BY 1`,
    prisma.$queryRaw<DayCount[]>`
      SELECT to_char("dischargeDate" AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS d, COUNT(*)::int AS c
      FROM "Patient" WHERE "hospitalId" = ${hospitalId} AND "deletedAt" IS NULL AND "dischargeDate" >= ${start}
      GROUP BY 1`,
  ]);

  const buckets = new Map<string, FlowDay>();
  for (let i = 0; i < days; i++) {
    const date = utcDay(new Date(start.getTime() + i * DAY_MS));
    buckets.set(date, { date, admissions: 0, discharges: 0 });
  }
  for (const { d, c } of admitted) {
    const b = buckets.get(d);
    if (b) b.admissions = Number(c);
  }
  for (const { d, c } of discharged) {
    const b = buckets.get(d);
    if (b) b.discharges = Number(c);
  }
  return Array.from(buckets.values());
};

export interface PatientListQuery {
  status?: unknown;
  department?: unknown;
  search?: unknown;
  page?: unknown;
  limit?: unknown;
}

const isRealFilter = (v: unknown): boolean => !!v && v !== 'undefined' && v !== 'ALL' && v !== 'All';

export const buildPatientWhere = (hospitalId: string, q: PatientListQuery): Prisma.PatientWhereInput => {
  const where: Prisma.PatientWhereInput = { hospitalId, deletedAt: null };
  if (isRealFilter(q.status)) where.status = (q.status as string).toUpperCase() as PatientStatus;
  if (isRealFilter(q.department)) where.department = q.department as string;
  if (q.search && q.search !== 'undefined') {
    where.OR = [
      { name: { contains: q.search as string, mode: 'insensitive' } },
      { patientCode: { contains: q.search as string, mode: 'insensitive' } },
    ];
  }
  return where;
};

export const listPatients = async (hospitalId: string, q: PatientListQuery) => {
  const pageNum = Math.max(1, parseInt((q.page ?? '1') as string) || 1);
  const limitNum = Math.min(50, Math.max(1, parseInt((q.limit ?? '10') as string) || 10));
  const where = buildPatientWhere(hospitalId, q);

  const [patients, totalCount] = await Promise.all([
    prisma.patient.findMany({
      where,
      skip: (pageNum - 1) * limitNum,
      take: limitNum,
      orderBy: { admissionDate: 'desc' },
      select: {
        id: true,
        patientCode: true,
        name: true,
        age: true,
        gender: true,
        department: true,
        diagnosis: true,
        status: true,
        admissionDate: true,
        dischargeDate: true,
        bedId: true,
        bed: { select: { bedNumber: true, ward: { select: { name: true } } } },
      },
    }),
    prisma.patient.count({ where }),
  ]);

  const totalPages = Math.ceil(totalCount / limitNum);
  return {
    patients,
    pagination: {
      page: pageNum,
      limit: limitNum,
      totalCount,
      totalPages,
      hasNextPage: pageNum < totalPages,
      hasPrevPage: pageNum > 1,
    },
  };
};
