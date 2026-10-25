// tests-int/helpers/factories.ts
import jwt from 'jsonwebtoken';
import type { Role } from '@prisma/client';
import prisma from '../../src/config/db';
import { JWT_SECRET } from '../../src/config/jwt';

let seq = 0;
const n = () => ++seq;

export const makeHospital = (over: { name?: string; code?: string } = {}) => {
  const i = n();
  return prisma.hospital.create({ data: { name: over.name ?? `Hospital ${i}`, location: 'Test City', code: over.code ?? `H${i}` } });
};

export const makeUser = (hospitalId: string, role: Role = 'DOCTOR', over: Partial<{ name: string; accountStatus: 'ACTIVE' | 'PENDING' | 'DISABLED'; department: string; passwordChangedAt: Date }> = {}) => {
  const i = n();
  return prisma.user.create({
    data: {
      email: `user${i}@int.test`, password: 'not-a-real-hash', name: over.name ?? `User ${i}`, role, department: over.department ?? 'ICU', shift: 'DAY',
      accountStatus: over.accountStatus ?? 'ACTIVE', hospitalId, emailVerifiedAt: new Date(), passwordChangedAt: over.passwordChangedAt,
    },
  });
};

/** A session token for `userId`. `ageSeconds` backdates `iat` (tokens issued before passwordChangedAt are revoked). */
export const tokenFor = (userId: string, ageSeconds = 0): string =>
  jwt.sign({ userId, iat: Math.floor(Date.now() / 1000) - ageSeconds }, JWT_SECRET, { expiresIn: '1h' });

export const bearer = (userId: string): string => `Bearer ${tokenFor(userId)}`;

export const makeWard = (hospitalId: string, name = `Ward ${n()}`) => prisma.ward.create({ data: { name, hospitalId } });
export const makeBed = (hospitalId: string, wardId: string, bedNumber = `B${n()}`) => prisma.bed.create({ data: { hospitalId, wardId, bedNumber } });

export const makePatient = (hospitalId: string, over: Partial<{ name: string; department: string; bedId: string; doctorId: string; status: 'OBSERVATION' | 'STABLE' | 'CRITICAL' | 'DISCHARGED'; patientCode: string }> = {}) => {
  const i = n();
  return prisma.patient.create({
    data: {
      patientCode: over.patientCode ?? `PT-${1000 + i}`, name: over.name ?? `Patient ${i}`, age: 40, gender: 'MALE', department: over.department ?? 'ICU',
      diagnosis: 'Test diagnosis', status: over.status ?? 'OBSERVATION', hospitalId, bedId: over.bedId, doctorId: over.doctorId,
    },
  });
};

export const makeStaff = (hospitalId: string, over: Partial<{ name: string; userId: string; department: string }> = {}) => {
  const i = n();
  return prisma.staff.create({ data: { name: over.name ?? `Dr Staff ${i}`, email: `staff${i}@int.test`, role: 'Doctor', department: over.department ?? 'ICU', hospitalId, userId: over.userId } });
};

export const makeMedication = (hospitalId: string, over: Partial<{ name: string; stockQuantity: number; unitPriceMinor: number; active: boolean }> = {}) =>
  prisma.medication.create({
    data: { hospitalId, name: over.name ?? `Med ${n()}`, form: 'tablet', strength: '500 mg', stockQuantity: over.stockQuantity ?? 0, unitPriceMinor: over.unitPriceMinor ?? 100, active: over.active ?? true },
  });

/** An ACTIVE prescription with one item for `medicationId`; returns the prescription and its item. */
export const makePrescription = async (hospitalId: string, patientId: string, medicationId: string) => {
  const rx = await prisma.prescription.create({
    data: { hospitalId, patientId, prescriberName: 'Dr Test', items: { create: [{ medicationId, dose: '1 tab', frequency: 'TID' }] } },
    include: { items: true },
  });
  return { prescription: rx, item: rx.items[0] };
};

/** A hospital with an admin, a doctor and a nurse (all ACTIVE), plus a ward/bed/patient: the usual starting point. */
export const makeWorld = async () => {
  const hospital = await makeHospital();
  const [admin, doctor, nurse] = await Promise.all([makeUser(hospital.id, 'ADMIN'), makeUser(hospital.id, 'DOCTOR'), makeUser(hospital.id, 'NURSE')]);
  const ward = await makeWard(hospital.id);
  const bed = await makeBed(hospital.id, ward.id);
  const patient = await makePatient(hospital.id);
  return { hospital, admin, doctor, nurse, ward, bed, patient };
};
