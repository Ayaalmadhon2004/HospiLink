// constants/hospital.ts
// Option labels are i18n keys; FieldRenderer translates them (see components/Form).
export const DEPARTMENTS = [
  'Cardiology',
  'Emergency',
  'Pediatrics',
  'Surgery',
  'Maternity',
  'Orthopedics',
  'Neurology',
  'Oncology',
  'Radiology',
  'General',
] as const;

export type Department = (typeof DEPARTMENTS)[number];

export const DEPARTMENT_OPTIONS = DEPARTMENTS.map((d) => ({ value: d, label: `departments.${d}` }));

export const GENDERS = ['MALE', 'FEMALE'] as const;

export const GENDER_OPTIONS = GENDERS.map((g) => ({
  value: g,
  label: `gender.${g}`,
}));

export const DEFAULT_HOSPITAL_ID = 'e4eb651b-fc3c-4284-a73d-9178e77195d8';