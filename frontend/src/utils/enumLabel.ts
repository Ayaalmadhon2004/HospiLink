import type { TFunction } from 'i18next';

/**
 * Enum group -> locale key prefix. The values are the backend enum values (sent to the API as-is);
 * only their labels are translated. Unknown values fall back to the raw value, so a new backend enum
 * value never renders as an empty cell or a raw key.
 */
export const ENUM_KEYS = {
  role: 'users.roles',
  accountStatus: 'users.status',
  patientStatus: 'status',
  gender: 'gender',
  shiftType: 'staff.shifts',
  dutyStatus: 'enums.dutyStatus',
  staffStatus: 'staff.status',
  appointmentType: 'appointments.types',
  appointmentStatus: 'enums.appointmentStatus',
  incidentType: 'incidents.types',
  incidentSeverity: 'incidents.severity',
  incidentStatus: 'incidents.status',
  bedStatus: 'beds.status',
  unitType: 'dispatch.unitTypes',
  unitStatus: 'dispatch.status',
  callStatus: 'enums.callStatus',
  priority: 'enums.priority',
  noteType: 'clinical.noteTypes',
  labPriority: 'clinical.priority',
  labStatus: 'clinical.labs.status',
  labFlag: 'clinical.labs.flags',
  prescriptionStatus: 'clinical.rx.status',
  invoiceStatus: 'billing.status',
  paymentMethod: 'billing.methods',
  stockMovement: 'enums.stockMovement',
  auditAction: 'enums.auditAction',
  authTokenType: 'enums.authTokenType',
} as const;

export type EnumGroup = keyof typeof ENUM_KEYS;

/** Translated label of an enum value; null/undefined -> '' and unknown values -> the raw value. */
export const enumLabel = (t: TFunction, group: EnumGroup, value: string | null | undefined): string => {
  if (!value) return '';
  return t(`${ENUM_KEYS[group]}.${value}`, { defaultValue: value });
};
