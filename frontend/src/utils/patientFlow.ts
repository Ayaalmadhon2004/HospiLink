export interface PatientFlowData {
  labels: string[];
  datasets: Array<{ label: string; data: number[]; borderColor?: string }>;
}

/** One day of GET /patients/flow (date is a UTC day, YYYY-MM-DD). */
export interface PatientFlowDay {
  date: string;
  admissions: number;
  discharges: number;
}

/** Chart data from the daily admissions/discharges the backend already aggregated. */
export const buildPatientFlow = (
  days: PatientFlowDay[],
  labels: { admissions: string; discharges: string },
  locale: string,
): PatientFlowData => ({
  labels: days.map((d) =>
    new Date(`${d.date}T00:00:00Z`).toLocaleDateString(locale, { weekday: 'short', day: 'numeric', timeZone: 'UTC' }),
  ),
  datasets: [
    { label: labels.admissions, data: days.map((d) => d.admissions), borderColor: '#0ea5e9' },
    { label: labels.discharges, data: days.map((d) => d.discharges), borderColor: '#10b981' },
  ],
});
