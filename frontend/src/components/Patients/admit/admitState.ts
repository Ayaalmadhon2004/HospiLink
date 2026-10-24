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

export const GENDERS = ['MALE', 'FEMALE'] as const;

export interface AdmitFormData {
  name: string;
  age: string;
  gender: string;
  department: string;
  diagnosis: string;
  bedId: string;
}

export interface AvailableBed {
  id: string;
  bedNumber: string;
  wardId?: string;
  ward?: { id: string; name: string };
  wardName?: string;
  status: string;
}

export interface AdmitState {
  formData: AdmitFormData;
  availableBeds: AvailableBed[];
  bedsLoading: boolean;
  bedsError: string;
  submitting: boolean;
  error: string;
  errorDetails: string;
  success: boolean;
}

export type AdmitAction =
  | { type: 'SET_FIELD'; field: keyof AdmitFormData; value: string }
  | { type: 'FETCH_BEDS_START' }
  | { type: 'FETCH_BEDS_SUCCESS'; beds: AvailableBed[] }
  | { type: 'FETCH_BEDS_ERROR'; error: string }
  | { type: 'SUBMIT_START' }
  | { type: 'SUBMIT_SUCCESS' }
  | { type: 'SUBMIT_ERROR'; error: string; details?: string }
  | { type: 'RESET_FORM' }
  | { type: 'CLEAR_ERROR' }
  | { type: 'CLEAR_BED' };

export const initialAdmitState: AdmitState = {
  formData: { name: '', age: '', gender: 'MALE', department: '', diagnosis: '', bedId: '' },
  availableBeds: [],
  bedsLoading: false,
  bedsError: '',
  submitting: false,
  error: '',
  errorDetails: '',
  success: false,
};

export const admitReducer = (state: AdmitState, action: AdmitAction): AdmitState => {
  switch (action.type) {
    case 'SET_FIELD':
      // The free beds depend on the department, so changing it drops the chosen bed.
      return {
        ...state,
        formData: {
          ...state.formData,
          [action.field]: action.value,
          ...(action.field === 'department' ? { bedId: '' } : {}),
        },
      };
    case 'FETCH_BEDS_START':
      return { ...state, bedsLoading: true, bedsError: '' };
    case 'FETCH_BEDS_SUCCESS':
      return { ...state, bedsLoading: false, availableBeds: action.beds };
    case 'FETCH_BEDS_ERROR':
      return { ...state, bedsLoading: false, bedsError: action.error, availableBeds: [] };
    case 'SUBMIT_START':
      return { ...state, submitting: true, error: '', errorDetails: '', success: false };
    case 'SUBMIT_SUCCESS':
      return { ...state, submitting: false, success: true };
    case 'SUBMIT_ERROR':
      return { ...state, submitting: false, error: action.error, errorDetails: action.details ?? '' };
    case 'RESET_FORM':
      return initialAdmitState;
    case 'CLEAR_ERROR':
      return { ...state, error: '', errorDetails: '' };
    case 'CLEAR_BED':
      return { ...state, formData: { ...state.formData, bedId: '' } };
  }
};

const MAX_AGE = 150;

/** Translation key of the first problem in the form, or null when it can be submitted. */
export const validateAdmitForm = (form: AdmitFormData): string | null => {
  if (!form.name.trim()) return 'patients.admitModal.nameRequired';
  const age = Number(form.age);
  if (!form.age || Number.isNaN(age) || age < 0 || age > MAX_AGE) return 'patients.admitModal.ageRequired';
  if (!form.department) return 'patients.admitModal.departmentRequired';
  if (!form.diagnosis.trim()) return 'patients.admitModal.diagnosisRequired';
  return null;
};

/** Beds keyed by ward name (insertion order kept); beds without a ward go to `fallbackWard`. */
export const groupBedsByWard = (beds: readonly AvailableBed[], fallbackWard: string): Record<string, AvailableBed[]> =>
  beds.reduce<Record<string, AvailableBed[]>>((groups, bed) => {
    const ward = bed.ward?.name || bed.wardName || fallbackWard;
    (groups[ward] ??= []).push(bed);
    return groups;
  }, {});
