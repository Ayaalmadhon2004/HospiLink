// backend/src/services/clinicalAccess.ts
//
// Shared guards for the clinical-record controllers: the patient must belong to the caller's hospital and not be
// soft-deleted, and the author is recorded both as a login id and as a name snapshot.
import type { Request } from 'express';
import prisma from '../config/db';
import { hospitalIdOf } from '../utils/tenant';

export const findTenantPatient = (req: Request, patientId: string) =>
  prisma.patient.findFirst({
    where: { id: patientId, hospitalId: hospitalIdOf(req), deletedAt: null },
    select: { id: true, name: true, department: true, hospitalId: true, doctor: { select: { userId: true } } },
  });

/** Who is acting, for the immutable authorship columns. */
export const actorOf = async (req: Request): Promise<{ id: string; name: string }> => {
  const id = req.user?.id as string;
  const row = await prisma.user.findUnique({ where: { id }, select: { name: true } });
  return { id, name: row?.name ?? 'Unknown' };
};
