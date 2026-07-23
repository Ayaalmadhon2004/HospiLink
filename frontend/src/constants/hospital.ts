// constants/hospital.ts
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

export const DEPARTMENT_OPTIONS = DEPARTMENTS.map((d) => ({ value: d, label: d }));

export const GENDERS = ['MALE', 'FEMALE', 'OTHER'] as const;

export const GENDER_OPTIONS = GENDERS.map((g) => ({
  value: g,
  label: g.charAt(0) + g.slice(1).toLowerCase(),
}));

export const DEFAULT_HOSPITAL_ID = 'e4eb651b-fc3c-4284-a73d-9178e77195d8';