import type { Patient } from '../types/patient';

export interface PatientFlowData {
  labels: string[];
  datasets: Array<{ label: string; data: number[]; borderColor?: string }>;
}

const DAY_MS = 24 * 60 * 60 * 1000;

const dayKey = (d: Date): string => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

/**
 * Daily admissions and discharges for the last `days` days (today included),
 * counted from the patients' admissionDate / dischargeDate.
 */
export const buildPatientFlow = (
  patients: Pick<Patient, 'admissionDate' | 'dischargeDate'>[],
  labels: { admissions: string; discharges: string },
  locale: string,
  days = 7,
  now: Date = new Date(),
): PatientFlowData => {
  const buckets = Array.from({ length: days }, (_, i) => new Date(now.getTime() - (days - 1 - i) * DAY_MS));
  const index = new Map(buckets.map((d, i) => [dayKey(d), i]));
  const admissions = new Array<number>(days).fill(0);
  const discharges = new Array<number>(days).fill(0);

  for (const p of patients) {
    const a = p.admissionDate ? index.get(dayKey(new Date(p.admissionDate))) : undefined;
    if (a !== undefined) admissions[a] += 1;
    const d = p.dischargeDate ? index.get(dayKey(new Date(p.dischargeDate))) : undefined;
    if (d !== undefined) discharges[d] += 1;
  }

  return {
    labels: buckets.map((d) => d.toLocaleDateString(locale, { weekday: 'short', day: 'numeric' })),
    datasets: [
      { label: labels.admissions, data: admissions, borderColor: '#0ea5e9' },
      { label: labels.discharges, data: discharges, borderColor: '#10b981' },
    ],
  };
};
