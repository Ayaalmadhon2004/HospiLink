import type { RecordVitalsInput } from '../types/vitals';

export type Metric = 'heartRate' | 'systolicBP' | 'diastolicBP' | 'spO2' | 'temperature' | 'respiratoryRate';
export type Reading = Omit<RecordVitalsInput, 'patientId'>;

export interface MetricField {
  name: Metric;
  id: string;
  labelKey: string;
  /** Normal range / unit shown next to the label. */
  hint: string;
  min: number;
  max: number;
  step?: number;
  placeholder: string;
  decimal?: boolean;
}

export const METRIC_FIELDS: readonly MetricField[] = [
  { name: 'heartRate', id: 'heart-rate', labelKey: 'vitals.heartRate', hint: '(60-100)', min: 0, max: 300, placeholder: '72' },
  { name: 'systolicBP', id: 'systolic-bp', labelKey: 'vitals.page.systolic', hint: '(90-140)', min: 0, max: 300, placeholder: '120' },
  { name: 'diastolicBP', id: 'diastolic-bp', labelKey: 'vitals.page.diastolic', hint: '(60-90)', min: 0, max: 200, placeholder: '80' },
  { name: 'spO2', id: 'spo2', labelKey: 'vitals.spO2', hint: '(%)', min: 0, max: 100, step: 0.1, placeholder: '98', decimal: true },
  { name: 'temperature', id: 'temperature', labelKey: 'vitals.temperature', hint: '(°C)', min: 30, max: 45, step: 0.1, placeholder: '36.5', decimal: true },
  { name: 'respiratoryRate', id: 'respiratory-rate', labelKey: 'vitals.respiratoryRate', hint: '(12-20)', min: 0, max: 60, placeholder: '16' },
];


export type FormValues = Record<Metric | 'notes', string>;

export const EMPTY_FORM: FormValues = {
  heartRate: '',
  systolicBP: '',
  diastolicBP: '',
  spO2: '',
  temperature: '',
  respiratoryRate: '',
  notes: '',
};

/** Only the measured (non-empty) metrics are sent. */
export const toReading = (values: FormValues): Reading => {
  const reading: Reading = {};
  for (const field of METRIC_FIELDS) {
    const raw = values[field.name];
    if (raw) reading[field.name] = field.decimal ? parseFloat(raw) : parseInt(raw, 10);
  }
  if (values.notes) reading.notes = values.notes;
  return reading;
};
