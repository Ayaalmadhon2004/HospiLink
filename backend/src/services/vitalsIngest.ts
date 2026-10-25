// backend/src/services/vitalsIngest.ts
//
// Protocol-agnostic vitals pipeline. Manual entry (POST /api/vitals) and device ingestion
// (POST /api/vitals/ingest/:protocol) both end up here: judge against the department thresholds,
// store, emit `new-vital`, escalate the patient and notify on a critical reading.
import prisma from '../config/db';
import logger from '../config/logger';
import { getIO } from '../utils/socket';
import { clinicalRoom } from '../utils/tenant';
import { loadEffectiveThresholds, evaluateReading } from './vitalThresholds';
import { notify } from './notification.service';

export interface MetricValues {
  heartRate?: number | null;
  systolicBP?: number | null;
  diastolicBP?: number | null;
  spO2?: number | null;
  temperature?: number | null;
  respiratoryRate?: number | null;
}

// Judges a reading against the thresholds of the patient's department (own rows + built-in defaults).
export const checkCriticalVitals = async (
  hospitalId: string,
  department: string,
  vitals: MetricValues
): Promise<{ isCritical: boolean; alertType: string | null }> =>
  evaluateReading(vitals, await loadEffectiveThresholds(hospitalId, department));

// A critical reading escalates the patient to CRITICAL. It never downgrades (a clinician does that) and never
// touches a DISCHARGED patient. Returns true when the status actually changed.
export const escalatePatient = async (patient: { id: string; hospitalId: string }, alertType: string | null): Promise<boolean> => {
  try {
    const { count } = await prisma.patient.updateMany({
      where: { id: patient.id, hospitalId: patient.hospitalId, deletedAt: null, status: { notIn: ['CRITICAL', 'DISCHARGED'] } },
      data: { status: 'CRITICAL' },
    });
    if (count === 0) return false;
    const payload = { patientId: patient.id, status: 'CRITICAL', reason: alertType, timestamp: new Date() };
    getIO().to(`patient-${patient.id}`).emit('patient-status-changed', payload);
    getIO().to(clinicalRoom(patient.hospitalId)).emit('patient-status-changed', payload);
    return true;
  } catch (err) {
    // The reading is already saved and the alert goes out: do not fail the request, but make the failure visible.
    logger.error({ err, patientId: patient.id }, 'Could not escalate the patient to CRITICAL');
    return false;
  }
};

// Critical vitals go to the assigned doctor plus doctors/nurses of the patient's department.
export const notifyCriticalVitals = (
  patient: { id: string; name?: string | null; department: string; doctor?: { userId: string | null } | null; hospitalId: string },
  alertType: string | null,
  actorId?: string
) =>
  notify({
    type: 'VITALS',
    title: 'Critical vitals alert',
    message: `${patient.name ?? 'Patient'} (${patient.department}): ${alertType ?? 'critical reading'}`,
    link: `/patients/${patient.id}`,
    recipients: {
      roles: ['DOCTOR', 'NURSE'],
      department: patient.department,
      // Patient.doctor is a Staff record: its login (if any) is Staff.userId.
      userIds: patient.doctor?.userId ? [patient.doctor.userId] : [],
      hospitalId: patient.hospitalId,
      scopeUserId: actorId,
    },
  });

/** One normalised reading from any protocol adapter. */
export interface IncomingReading {
  patientCode: string;
  values: MetricValues;
  observedAt?: Date;
}

export type IngestOutcome =
  | { patientCode: string; status: 'stored'; vitalsId: string; isCritical: boolean }
  | { patientCode: string; status: 'rejected'; reason: 'PATIENT_NOT_FOUND' | 'NO_METRICS' | 'ERROR' };

const hasMetrics = (v: MetricValues): boolean => Object.values(v).some((x) => typeof x === 'number');

/**
 * Stores readings pushed by a device of `hospitalId`. Each reading is independent: one bad patient code
 * does not fail the batch. `recordedBy` is `device:<deviceKeyId>` so the source stays auditable.
 */
export const ingestReadings = async (hospitalId: string, deviceKeyId: string, readings: IncomingReading[]): Promise<IngestOutcome[]> => {
  const outcomes: IngestOutcome[] = [];
  for (const r of readings) {
    try {
      if (!hasMetrics(r.values)) {
        outcomes.push({ patientCode: r.patientCode, status: 'rejected', reason: 'NO_METRICS' });
        continue;
      }
      const patient = await prisma.patient.findFirst({
        where: { patientCode: r.patientCode, hospitalId, deletedAt: null },
        select: { id: true, name: true, department: true, doctor: { select: { userId: true } }, hospitalId: true },
      });
      if (!patient) {
        outcomes.push({ patientCode: r.patientCode, status: 'rejected', reason: 'PATIENT_NOT_FOUND' });
        continue;
      }
      const { isCritical, alertType } = await checkCriticalVitals(hospitalId, patient.department, r.values);
      const vitals = await prisma.patientVitals.create({
        data: {
          patientId: patient.id,
          ...r.values,
          ...(r.observedAt ? { recordedAt: r.observedAt } : {}),
          recordedBy: `device:${deviceKeyId}`,
          isCritical,
          alertType,
        },
      });
      getIO().to(`patient-${patient.id}`).emit('new-vital', vitals);
      if (isCritical) {
        await escalatePatient(patient, alertType);
        await notifyCriticalVitals(patient, alertType);
      }
      outcomes.push({ patientCode: r.patientCode, status: 'stored', vitalsId: vitals.id, isCritical });
    } catch (err) {
      logger.error({ err, patientCode: r.patientCode }, 'Vitals ingest failed for one reading');
      outcomes.push({ patientCode: r.patientCode, status: 'rejected', reason: 'ERROR' });
    }
  }
  return outcomes;
};
