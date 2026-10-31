// backend/src/services/patientAdmission.ts
// Admit / update / discharge / delete transactions for patients (extracted from patient.controller).
import prisma from '../config/db';
import { claimBed, releaseBed } from './bedAssignment';
import type { PatientStatus, Prisma } from '@prisma/client';

const PATIENT_CODE_BASE = 2040;
const MAX_CODE_ATTEMPTS = 10;
// Serialises patient-code allocation between concurrent admits (transaction-scoped advisory lock, released on commit/rollback).
const PATIENT_CODE_LOCK_KEY = 4204001;

// Business-rule failure inside the admit transaction: safe to show to the client.
export class AdmitError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export const isPatientCodeConflict = (error: unknown): boolean => {
  const e = error as { code?: string; meta?: { target?: unknown } };
  return e?.code === 'P2002' && String(e.meta?.target ?? 'patientCode').includes('patientCode');
};

// Next free number: above both the row count and the highest existing PT-<n>,
// so deleted or seeded rows can't make the count-based guess collide.
export const nextPatientNumber = async (db: Pick<typeof prisma, 'patient'> = prisma): Promise<number> => {
  const count = await db.patient.count();
  const agg = await db.patient.aggregate({
    _max: { patientCode: true },
    where: { patientCode: { startsWith: 'PT-' } },
  });
  const highest = Number(agg?._max?.patientCode?.slice(3));
  return Math.max(PATIENT_CODE_BASE + count, Number.isFinite(highest) ? highest : 0) + 1;
};

export interface AdmitInput {
  name: string;
  age: string | number;
  gender: Prisma.PatientUncheckedCreateInput['gender'];
  department: string;
  diagnosis: string;
  bedId?: string | null;
  doctorId?: string | null;
}

export const admitPatientTx = async (input: AdmitInput, hospitalId: string) => {
  const { name, age, gender, department, diagnosis, bedId, doctorId } = input;

  for (let attempt = 0; ; attempt++) {
    try {
      return await prisma.$transaction(async (tx) => {
        // pg_advisory_xact_lock returns void, which only $executeRaw tolerates (found by the integration suite).
        // Under the lock a concurrent admit has already committed its row, so the number read here is really free.
        // (Without it, N simultaneous admits all read the same "next" number and N-1 of them collide.)
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${PATIENT_CODE_LOCK_KEY}::bigint)`;
        const patientCode = `PT-${await nextPatientNumber(tx)}`;
        let validBedId = null;

        if (doctorId) {
          const doctor = await tx.staff.findFirst({ where: { id: doctorId, hospitalId }, select: { id: true } });
          if (!doctor) throw new AdmitError('Doctor not found', 404);
        }

        if (bedId) {
          // Atomic: only a free AVAILABLE bed can be claimed (404 / 409 otherwise).
          await claimBed(tx, bedId, hospitalId);
          validBedId = bedId;
        }

        const patientData: Prisma.PatientUncheckedCreateInput = {
          patientCode,
          name,
          age: parseInt(String(age)),
          gender,
          department,
          diagnosis,
          status: 'OBSERVATION',
          hospitalId,
        };

        if (validBedId) patientData.bedId = validBedId;
        if (doctorId) patientData.doctorId = doctorId;

        return tx.patient.create({ data: patientData });
      });
    } catch (error) {
      // Concurrent admits can pick the same number; the unique index rejects one, so retry with the next.
      if (isPatientCodeConflict(error) && attempt < MAX_CODE_ATTEMPTS - 1) continue;
      throw error;
    }
  }
};

export interface PatientUpdateInput {
  fields: Omit<Prisma.PatientUncheckedUpdateInput, 'bedId'> & { doctorId?: string | null; status?: PatientStatus };
  requestedBedId?: string | null;
}

const runPatientUpdate = (
  id: string,
  hospitalId: string,
  fields: PatientUpdateInput['fields'],
  existingBedId: string | null,
  targetBedId: string | null,
  justDischarged: boolean,
) => {
  const bedChanges = targetBedId !== existingBedId;
  return prisma.$transaction(async (tx) => {
    if (bedChanges) {
      if (targetBedId) await claimBed(tx, targetBedId, hospitalId);
      if (existingBedId) await releaseBed(tx, existingBedId, hospitalId);
    }
    return tx.patient.update({
      where: { id },
      data: {
        ...fields,
        ...(bedChanges ? { bedId: targetBedId } : {}),
        ...(justDischarged && !fields.dischargeDate ? { dischargeDate: new Date() } : {}),
      },
      include: { bed: true },
    });
  });
};

export type UpdatePatientOutcome =
  | { kind: 'not-found' }
  | { kind: 'doctor-not-found' }
  | { kind: 'discharged-with-bed' }
  | { kind: 'ok'; patient: Awaited<ReturnType<typeof runPatientUpdate>> };

export const updatePatientRecord = async (
  id: string,
  hospitalId: string,
  { fields, requestedBedId }: PatientUpdateInput,
): Promise<UpdatePatientOutcome> => {
  const existing = await prisma.patient.findFirst({ where: { id, hospitalId, deletedAt: null }, select: { id: true, bedId: true, status: true } });
  if (!existing) return { kind: 'not-found' };
  if (fields.doctorId && !(await prisma.staff.findFirst({ where: { id: fields.doctorId, hospitalId }, select: { id: true } }))) {
    return { kind: 'doctor-not-found' };
  }

  // Bed rules (OCCUPIED <=> has a patient): a DISCHARGED patient holds no bed and cannot be given one.
  const discharging = (fields.status ?? existing.status) === 'DISCHARGED';
  if (discharging && requestedBedId) return { kind: 'discharged-with-bed' };
  // The bed the patient ends up in: discharge frees it, an explicit bedId (or null) replaces it, otherwise unchanged.
  const targetBedId = discharging ? null : requestedBedId === undefined ? existing.bedId : requestedBedId;
  const justDischarged = discharging && existing.status !== 'DISCHARGED';

  const patient = await runPatientUpdate(id, hospitalId, fields, existing.bedId, targetBedId, justDischarged);
  return { kind: 'ok', patient };
};

/** Soft delete; returns false when the patient does not exist in the hospital. */
export const softDeletePatient = async (id: string, hospitalId: string): Promise<boolean> => {
  const patient = await prisma.patient.findFirst({ where: { id, hospitalId, deletedAt: null }, select: { id: true, bedId: true } });
  if (!patient) return false;

  await prisma.$transaction(async (tx) => {
    if (patient.bedId) await releaseBed(tx, patient.bedId, hospitalId);
    await tx.patient.update({ where: { id }, data: { deletedAt: new Date(), bedId: null } });
  });
  return true;
};

/** Returns null when the patient does not exist in the hospital. */
export const dischargePatientRecord = async (id: string, hospitalId: string) => {
  const patient = await prisma.patient.findFirst({
    where: { id, hospitalId, deletedAt: null },
    include: { bed: true },
  });
  if (!patient) return null;

  return prisma.$transaction(async (tx) => {
    if (patient.bedId) await releaseBed(tx, patient.bedId, hospitalId);
    return tx.patient.update({
      where: { id },
      data: { status: 'DISCHARGED', dischargeDate: new Date(), bedId: null },
    });
  });
};
