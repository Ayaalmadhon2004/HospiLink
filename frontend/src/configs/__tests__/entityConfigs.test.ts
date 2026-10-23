import { describe, it, expect } from 'vitest';
import type { ZodTypeAny } from 'zod';
import {
  patientFields,
  patientValidationSchema,
  bedFields,
  bedValidationSchema,
  appointmentFields,
  appointmentValidationSchema,
  staffFields,
  staffValidationSchema,
  incidentFields,
  incidentValidationSchema,
} from '../entityConfigs';
import type { FieldConfig } from '../../components/Form/types';

const failsOn = (schema: ZodTypeAny, input: unknown, field: string): boolean => {
  const res = schema.safeParse(input);
  return !res.success && res.error.issues.some((i) => i.path[0] === field);
};

const without = (obj: Record<string, string>, key: string): Record<string, string> => {
  const copy = { ...obj };
  delete copy[key];
  return copy;
};

const validPatient = { name: 'Jane Doe', age: '34', gender: 'FEMALE', department: 'Cardiology', diagnosis: 'Arrhythmia' };
const validBed = { bedNumber: 'ICU-101', wardId: 'ward-1', status: 'AVAILABLE' };
const validAppointment = {
  patientName: 'John Doe',
  patientCode: 'PT-2052',
  doctorId: 'doc-1',
  type: 'CONSULTATION',
  scheduledDate: '2026-11-01',
  scheduledTime: '09:30',
};
const validStaff = {
  name: 'Dr. Who',
  email: 'who@hospilink.com',
  role: 'Surgeon',
  department: 'Surgery',
  status: 'ACTIVE',
};
const validIncident = {
  title: 'Fall in corridor',
  type: 'PATIENT_FALL',
  severity: 'LOW',
  location: 'Ward B',
  reportedBy: 'Nurse Amal',
  description: 'Patient slipped near the nurses station.',
};

describe('patientValidationSchema', () => {
  it('accepts valid input, with and without bedId', () => {
    expect(patientValidationSchema.safeParse(validPatient).success).toBe(true);
    expect(patientValidationSchema.safeParse({ ...validPatient, bedId: 'bed-1' }).success).toBe(true);
  });

  it.each(['name', 'age', 'gender', 'department', 'diagnosis'])('rejects missing %s', (field) => {
    expect(failsOn(patientValidationSchema, without(validPatient, field), field)).toBe(true);
  });

  it.each(['name', 'gender', 'department', 'diagnosis'])('rejects empty %s', (field) => {
    expect(failsOn(patientValidationSchema, { ...validPatient, [field]: '' }, field)).toBe(true);
  });

  it('enforces the 0..150 age range and numeric ages', () => {
    expect(patientValidationSchema.safeParse({ ...validPatient, age: '0' }).success).toBe(true);
    expect(patientValidationSchema.safeParse({ ...validPatient, age: '150' }).success).toBe(true);
    expect(failsOn(patientValidationSchema, { ...validPatient, age: '-1' }, 'age')).toBe(true);
    expect(failsOn(patientValidationSchema, { ...validPatient, age: '151' }, 'age')).toBe(true);
    expect(failsOn(patientValidationSchema, { ...validPatient, age: 'abc' }, 'age')).toBe(true);
  });
});

describe('bedValidationSchema', () => {
  it('accepts valid input for every status', () => {
    for (const status of ['AVAILABLE', 'OCCUPIED', 'CLEANING', 'MAINTENANCE']) {
      expect(bedValidationSchema.safeParse({ ...validBed, status }).success).toBe(true);
    }
    expect(bedValidationSchema.safeParse({ ...validBed, patientId: 'p-1' }).success).toBe(true);
  });

  it('rejects missing or empty required fields', () => {
    expect(failsOn(bedValidationSchema, { ...validBed, bedNumber: '' }, 'bedNumber')).toBe(true);
    expect(failsOn(bedValidationSchema, { ...validBed, wardId: '' }, 'wardId')).toBe(true);
    expect(failsOn(bedValidationSchema, without(validBed, 'status'), 'status')).toBe(true);
  });

  it('rejects an unknown status', () => {
    expect(failsOn(bedValidationSchema, { ...validBed, status: 'BROKEN' }, 'status')).toBe(true);
  });
});

describe('appointmentValidationSchema', () => {
  it('accepts valid input, with and without optional fields', () => {
    expect(appointmentValidationSchema.safeParse(validAppointment).success).toBe(true);
    expect(
      appointmentValidationSchema.safeParse({
        ...validAppointment,
        duration: '30',
        department: 'Cardiology',
        room: 'C-214',
        notes: 'Bring previous scans',
      }).success,
    ).toBe(true);
  });

  it.each(['patientName', 'patientCode', 'doctorId', 'type', 'scheduledDate', 'scheduledTime'])(
    'rejects missing and empty %s',
    (field) => {
      expect(failsOn(appointmentValidationSchema, without(validAppointment, field), field)).toBe(true);
      expect(failsOn(appointmentValidationSchema, { ...validAppointment, [field]: '' }, field)).toBe(true);
    },
  );
});

describe('staffValidationSchema', () => {
  it('accepts valid input, with and without optional fields', () => {
    expect(staffValidationSchema.safeParse(validStaff).success).toBe(true);
    expect(
      staffValidationSchema.safeParse({ ...validStaff, phone: '+1 234', shiftStart: '08:00', shiftEnd: '16:00' }).success,
    ).toBe(true);
  });

  it('rejects invalid or empty emails', () => {
    expect(failsOn(staffValidationSchema, { ...validStaff, email: 'not-an-email' }, 'email')).toBe(true);
    expect(failsOn(staffValidationSchema, { ...validStaff, email: '' }, 'email')).toBe(true);
  });

  it.each(['name', 'role', 'department'])('rejects empty %s', (field) => {
    expect(failsOn(staffValidationSchema, { ...validStaff, [field]: '' }, field)).toBe(true);
  });

  it('rejects an unknown or missing status', () => {
    expect(failsOn(staffValidationSchema, { ...validStaff, status: 'FIRED' }, 'status')).toBe(true);
    expect(failsOn(staffValidationSchema, without(validStaff, 'status'), 'status')).toBe(true);
  });
});

describe('incidentValidationSchema', () => {
  it('accepts valid input for every severity', () => {
    for (const severity of ['CRITICAL', 'ELEVATED', 'MODERATE', 'LOW']) {
      expect(incidentValidationSchema.safeParse({ ...validIncident, severity }).success).toBe(true);
    }
  });

  it.each(['title', 'type', 'location', 'reportedBy', 'description'])('rejects missing and empty %s', (field) => {
    expect(failsOn(incidentValidationSchema, without(validIncident, field), field)).toBe(true);
    expect(failsOn(incidentValidationSchema, { ...validIncident, [field]: '' }, field)).toBe(true);
  });

  it('rejects an unknown severity', () => {
    expect(failsOn(incidentValidationSchema, { ...validIncident, severity: 'MILD' }, 'severity')).toBe(true);
  });
});

describe('field definitions', () => {
  const VALID_TYPES = [
    'text', 'email', 'password', 'number', 'tel', 'date', 'time', 'datetime-local',
    'select', 'textarea', 'radio', 'checkbox', 'search-select', 'custom',
  ];

  type AnyFields = FieldConfig<never>[];
  const cases: [string, AnyFields, ZodTypeAny][] = [
    ['patient', patientFields as AnyFields, patientValidationSchema],
    ['bed', bedFields as AnyFields, bedValidationSchema],
    ['appointment', appointmentFields as AnyFields, appointmentValidationSchema],
    ['staff', staffFields as AnyFields, staffValidationSchema],
    ['incident', incidentFields as AnyFields, incidentValidationSchema],
  ];

  describe.each(cases)('%s fields', (_name, fields, schema) => {
    it('is non-empty with unique names, labels and valid types', () => {
      expect(fields.length).toBeGreaterThan(0);
      const names = fields.map((f) => f.name);
      expect(new Set(names).size).toBe(names.length);
      for (const f of fields) {
        expect(f.label.length).toBeGreaterThan(0);
        expect(VALID_TYPES).toContain(f.type);
        if (f.colSpan !== undefined) expect([1, 2]).toContain(f.colSpan);
      }
    });

    it('gives select fields non-empty options and search-select fields an apiEndpoint', () => {
      for (const f of fields) {
        if (f.type === 'select') {
          expect(f.options?.length ?? 0).toBeGreaterThan(0);
          for (const o of f.options ?? []) {
            expect(o.label).toBeTruthy();
            expect(o.value).toBeTruthy();
          }
        }
        if (f.type === 'search-select') expect(f.apiEndpoint).toMatch(/^\//);
      }
    });

    it('only names fields that exist in the validation schema', () => {
      const shape = (schema as unknown as { shape: Record<string, unknown> }).shape;
      for (const f of fields) expect(Object.keys(shape)).toContain(f.name);
    });
  });

  it('restricts patient gender options to the Gender enum (MALE/FEMALE)', () => {
    const gender = patientFields.find((f) => f.name === 'gender');
    expect(gender?.options?.map((o) => o.value)).toEqual(['MALE', 'FEMALE']);
  });

  it('keeps the select options in sync with the zod enums', () => {
    const values = (fields: AnyFields, name: string): string[] =>
      (fields.find((f) => f.name === name)?.options ?? []).map((o) => o.value);
    const bed = values(bedFields as AnyFields, 'status');
    expect(bed.length).toBe(4);
    for (const v of bed) expect(bedValidationSchema.safeParse({ ...validBed, status: v }).success).toBe(true);
    const staff = values(staffFields as AnyFields, 'status');
    expect(staff.length).toBe(3);
    for (const v of staff) expect(staffValidationSchema.safeParse({ ...validStaff, status: v }).success).toBe(true);
    const sev = values(incidentFields as AnyFields, 'severity');
    expect(sev.length).toBe(4);
    for (const v of sev) expect(incidentValidationSchema.safeParse({ ...validIncident, severity: v }).success).toBe(true);
  });

  it('marks key fields as required', () => {
    const required = (fields: AnyFields): string[] => fields.filter((f) => f.required).map((f) => f.name);
    expect(required(incidentFields as AnyFields)).toEqual(
      expect.arrayContaining(['title', 'type', 'severity', 'location', 'reportedBy', 'description']),
    );
    expect(required(bedFields as AnyFields)).toEqual(expect.arrayContaining(['bedNumber', 'wardId', 'status']));
  });

  it('disables the bed status field when a patient is assigned', () => {
    const status = bedFields.find((f) => f.name === 'status');
    expect(typeof status?.disabled).toBe('function');
    const fn = status?.disabled as (v: { patientId?: string }) => boolean;
    expect(fn({ patientId: 'p-1' })).toBe(true);
    expect(fn({})).toBe(false);
  });
});
