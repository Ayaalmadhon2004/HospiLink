import { useEffect, useReducer, useMemo, useCallback, useRef } from 'react';
import { X, Bed, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { admitPatient, getAvailableBeds } from '../../services/patientService';

interface AdmitPatientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: () => void;
}

const DEPARTMENTS = [
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

const GENDERS = ['MALE', 'FEMALE', 'OTHER'] as const;

// ─── Types ──────────────────────────────────────────────────────────
interface FormData {
  name: string;
  age: string;
  gender: string;
  department: string;
  diagnosis: string;
  bedId: string;
}

interface Bed {
  id: string;
  bedNumber: string;
  wardId?: string;
  ward?: { id: string; name: string };
  wardName?: string;
  status: string;
}

interface ModalState {
  formData: FormData;
  availableBeds: Bed[];
  bedsLoading: boolean;
  bedsError: string;
  submitting: boolean;
  error: string;
  errorDetails: string;
  success: boolean;
}

type ModalAction =
  | { type: 'SET_FIELD'; field: keyof FormData; value: string }
  | { type: 'SET_DEPARTMENT'; value: string }
  | { type: 'FETCH_BEDS_START' }
  | { type: 'FETCH_BEDS_SUCCESS'; beds: Bed[] }
  | { type: 'FETCH_BEDS_ERROR'; error: string }
  | { type: 'SUBMIT_START' }
  | { type: 'SUBMIT_SUCCESS' }
  | { type: 'SUBMIT_ERROR'; error: string; details?: string }
  | { type: 'RESET_FORM' }
  | { type: 'CLEAR_ERROR' }
  | { type: 'CLEAR_BED' };

// ─── Initial State ──────────────────────────────────────────────────
const initialFormData: FormData = {
  name: '',
  age: '',
  gender: 'MALE',
  department: '',
  diagnosis: '',
  bedId: '',
};

const initialState: ModalState = {
  formData: initialFormData,
  availableBeds: [],
  bedsLoading: false,
  bedsError: '',
  submitting: false,
  error: '',
  errorDetails: '',
  success: false,
};

// ─── Reducer ────────────────────────────────────────────────────────
function modalReducer(state: ModalState, action: ModalAction): ModalState {
  switch (action.type) {
    case 'SET_FIELD':
      return {
        ...state,
        formData: { ...state.formData, [action.field]: action.value },
      };

    case 'SET_DEPARTMENT':
      return {
        ...state,
        formData: { ...state.formData, department: action.value, bedId: '' },
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
      return {
        ...state,
        submitting: false,
        error: action.error,
        errorDetails: action.details || '',
      };

    case 'RESET_FORM':
      return initialState;

    case 'CLEAR_ERROR':
      return { ...state, error: '', errorDetails: '' };

    case 'CLEAR_BED':
      return { ...state, formData: { ...state.formData, bedId: '' } };

    default:
      return state;
  }
}

// ─── Component ────────────────────────────────────────────────────
export const AdmitPatientModal = ({ isOpen, onClose, onAdd }: AdmitPatientModalProps) => {
  const [state, dispatch] = useReducer(modalReducer, initialState);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);

  // ─── Escape key handler ───────────────────────────────────────────
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !state.submitting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose, state.submitting]);

  // ─── Focus trap & initial focus ──────────────────────────────────
  useEffect(() => {
    if (isOpen && firstInputRef.current) {
      firstInputRef.current.focus();
    }
  }, [isOpen]);

  // ─── Fetch beds when modal opens or department changes ────────────
  useEffect(() => {
    if (!isOpen) return;

    const controller = new AbortController();

    const fetchBeds = async () => {
      dispatch({ type: 'FETCH_BEDS_START' });
      try {
        const res = await getAvailableBeds(state.formData.department || undefined);
        const bedsData: Bed[] = res.data?.data || res.data || [];
        if (!controller.signal.aborted) {
          dispatch({ type: 'FETCH_BEDS_SUCCESS', beds: bedsData });
        }
      } catch (err: any) {
        if (!controller.signal.aborted) {
          console.error('Failed to fetch beds:', err);
          dispatch({
            type: 'FETCH_BEDS_ERROR',
            error: err.response?.data?.error || 'Failed to load available beds',
          });
        }
      }
    };

    fetchBeds();
    return () => controller.abort();
  }, [isOpen, state.formData.department]);

  // ─── Reset form when modal closes ─────────────────────────────────
  useEffect(() => {
    if (!isOpen) {
      dispatch({ type: 'RESET_FORM' });
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    }
  }, [isOpen]);

  // ─── Cleanup on unmount ──────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleChange = useCallback((field: keyof FormData, value: string) => {
    if (field === 'department') {
      dispatch({ type: 'SET_DEPARTMENT', value });
    } else {
      dispatch({ type: 'SET_FIELD', field, value });
    }
  }, []);

  // ─── Memoized beds grouping ──────────────────────────────────────
  const bedsByWard = useMemo(() => {
    return state.availableBeds.reduce<Record<string, Bed[]>>((acc, bed) => {
      const wardName = bed.ward?.name || bed.wardName || 'General Ward';
      if (!acc[wardName]) acc[wardName] = [];
      acc[wardName].push(bed);
      return acc;
    }, {});
  }, [state.availableBeds]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    dispatch({ type: 'CLEAR_ERROR' });

    // Validation
    if (!state.formData.name.trim()) {
      dispatch({ type: 'SUBMIT_ERROR', error: 'Patient name is required' });
      return;
    }
    const ageNum = Number(state.formData.age);
    if (!state.formData.age || isNaN(ageNum) || ageNum < 0 || ageNum > 150) {
      dispatch({ type: 'SUBMIT_ERROR', error: 'Valid age (0-150) is required' });
      return;
    }
    if (!state.formData.department) {
      dispatch({ type: 'SUBMIT_ERROR', error: 'Department is required' });
      return;
    }
    if (!state.formData.diagnosis.trim()) {
      dispatch({ type: 'SUBMIT_ERROR', error: 'Diagnosis is required' });
      return;
    }

    dispatch({ type: 'SUBMIT_START' });
    try {
      const payload = {
        name: state.formData.name.trim(),
        age: ageNum,
        gender: state.formData.gender,
        department: state.formData.department,
        diagnosis: state.formData.diagnosis.trim(),
        ...(state.formData.bedId ? { bedId: state.formData.bedId } : {}),
      };

      await admitPatient(payload);

      dispatch({ type: 'SUBMIT_SUCCESS' });
      timeoutRef.current = setTimeout(() => {
        onAdd();
      }, 800);
    } catch (err: any) {
      console.error('Admit error response:', err.response?.data);
      const backendError = err.response?.data;
      dispatch({
        type: 'SUBMIT_ERROR',
        error: backendError?.message || backendError?.error || 'Failed to admit patient',
        details: backendError?.fullError || backendError?.error || '',
      });
    }
  }, [state.formData, onAdd]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="admit-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !state.submitting) onClose();
      }}
    >
      <div 
        ref={modalRef}
        className="bg-white rounded-2xl w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between p-6 border-b border-slate-100 sticky top-0 bg-white rounded-t-2xl z-10">
          <h2 id="admit-modal-title" className="text-xl font-bold text-hospital-navy">
            Admit New Patient
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition focus:outline-none focus:ring-2 focus:ring-medical-teal"
            disabled={state.submitting}
            aria-label="Close modal"
            type="button"
          >
            <X size={20} className="text-clinic-text/50" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4" noValidate>
          {state.error && (
            <div 
              className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm"
              role="alert"
              aria-live="assertive"
            >
              <div className="flex items-center gap-2 mb-1">
                <AlertCircle size={16} aria-hidden="true" />
                <span className="font-medium">{state.error}</span>
              </div>
              {state.errorDetails && (
                <p className="text-xs text-red-400 ml-6">{state.errorDetails}</p>
              )}
            </div>
          )}

          {state.success && (
            <div 
              className="bg-green-50 border border-green-200 text-green-600 px-4 py-3 rounded-xl text-sm flex items-center gap-2"
              role="status"
              aria-live="polite"
            >
              <CheckCircle2 size={16} aria-hidden="true" />
              Patient admitted successfully!
            </div>
          )}

          {/* Name */}
          <div>
            <label htmlFor="patient-name" className="block text-sm font-medium text-clinic-text mb-1">
              Full Name <span className="text-red-500" aria-hidden="true">*</span>
              <span className="sr-only"> (required)</span>
            </label>
            <input
              ref={firstInputRef}
              id="patient-name"
              type="text"
              value={state.formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="Enter patient name"
              className="w-full border border-slate-200 px-4 py-2.5 rounded-xl focus:ring-2 focus:ring-medical-teal focus:border-medical-teal outline-none transition"
              disabled={state.submitting}
              aria-required="true"
              aria-invalid={!!state.error && !state.formData.name.trim()}
              aria-describedby={state.error && !state.formData.name.trim() ? 'form-error' : undefined}
              autoComplete="name"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="patient-age" className="block text-sm font-medium text-clinic-text mb-1">
                Age <span className="text-red-500" aria-hidden="true">*</span>
                <span className="sr-only"> (required)</span>
              </label>
              <input
                id="patient-age"
                type="number"
                min="0"
                max="150"
                value={state.formData.age}
                onChange={(e) => handleChange('age', e.target.value)}
                placeholder="Years"
                className="w-full border border-slate-200 px-4 py-2.5 rounded-xl focus:ring-2 focus:ring-medical-teal focus:border-medical-teal outline-none transition"
                disabled={state.submitting}
                aria-required="true"
                aria-invalid={!!state.error && (!state.formData.age || isNaN(Number(state.formData.age)))}
              />
            </div>
            <div>
              <label htmlFor="patient-gender" className="block text-sm font-medium text-clinic-text mb-1">
                Gender <span className="text-red-500" aria-hidden="true">*</span>
                <span className="sr-only"> (required)</span>
              </label>
              <select
                id="patient-gender"
                value={state.formData.gender}
                onChange={(e) => handleChange('gender', e.target.value)}
                className="w-full border border-slate-200 px-4 py-2.5 rounded-xl focus:ring-2 focus:ring-medical-teal focus:border-medical-teal outline-none bg-white transition"
                disabled={state.submitting}
                aria-required="true"
              >
                {GENDERS.map(g => (
                  <option key={g} value={g}>{g.charAt(0) + g.slice(1).toLowerCase()}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Department */}
          <div>
            <label htmlFor="patient-department" className="block text-sm font-medium text-clinic-text mb-1">
              Department <span className="text-red-500" aria-hidden="true">*</span>
              <span className="sr-only"> (required)</span>
            </label>
            <select
              id="patient-department"
              value={state.formData.department}
              onChange={(e) => handleChange('department', e.target.value)}
              className="w-full border border-slate-200 px-4 py-2.5 rounded-xl focus:ring-2 focus:ring-medical-teal focus:border-medical-teal outline-none bg-white transition"
              disabled={state.submitting}
              aria-required="true"
              aria-invalid={!!state.error && !state.formData.department}
            >
              <option value="">Select department</option>
              {DEPARTMENTS.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          {/* Diagnosis */}
          <div>
            <label htmlFor="patient-diagnosis" className="block text-sm font-medium text-clinic-text mb-1">
              Diagnosis <span className="text-red-500" aria-hidden="true">*</span>
              <span className="sr-only"> (required)</span>
            </label>
            <input
              id="patient-diagnosis"
              type="text"
              value={state.formData.diagnosis}
              onChange={(e) => handleChange('diagnosis', e.target.value)}
              placeholder="Enter diagnosis"
              className="w-full border border-slate-200 px-4 py-2.5 rounded-xl focus:ring-2 focus:ring-medical-teal focus:border-medical-teal outline-none transition"
              disabled={state.submitting}
              aria-required="true"
              aria-invalid={!!state.error && !state.formData.diagnosis.trim()}
            />
          </div>

          {/* Bed Selection */}
          <fieldset>
            <legend className="block text-sm font-medium text-clinic-text mb-2 flex items-center gap-2">
              <Bed size={16} className="text-medical-teal" aria-hidden="true" />
              Assign Bed (Optional)
            </legend>

            {state.bedsLoading ? (
              <div className="flex items-center gap-2 text-sm text-clinic-text/50 py-3" role="status">
                <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                Loading available beds...
              </div>
            ) : state.bedsError ? (
              <div 
                className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600 flex items-center gap-2"
                role="alert"
              >
                <AlertCircle size={16} aria-hidden="true" />
                {state.bedsError}
              </div>
            ) : state.availableBeds.length === 0 ? (
              <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-clinic-text/50">
                No available beds found
                {state.formData.department && ' for this department'}
              </div>
            ) : (
              <div 
                className="border border-slate-200 rounded-xl overflow-hidden max-h-48 overflow-y-auto"
                role="radiogroup"
                aria-label="Available beds"
              >
                {Object.entries(bedsByWard).map(([wardName, beds]) => (
                  <div key={wardName}>
                    <div className="bg-slate-50 px-4 py-2 text-xs font-semibold text-clinic-text/60 uppercase tracking-wide">
                      {wardName}
                    </div>
                    <div className="divide-y divide-slate-100">
                      {beds.map((bed) => (
                        <label
                          key={bed.id}
                          className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-slate-50 transition ${
                            state.formData.bedId === bed.id ? 'bg-medical-teal/5' : ''
                          }`}
                        >
                          <input
                            type="radio"
                            name="bedId"
                            value={bed.id}
                            checked={state.formData.bedId === bed.id}
                            onChange={(e) => handleChange('bedId', e.target.value)}
                            className="w-4 h-4 text-medical-teal focus:ring-medical-teal"
                            disabled={state.submitting}
                            aria-label={`Bed ${bed.bedNumber} in ${wardName}`}
                          />
                          <div className="flex-1">
                            <span className="text-sm font-medium text-clinic-text">
                              Bed {bed.bedNumber}
                            </span>
                            <span className="text-xs text-green-600 ml-2 bg-green-50 px-2 py-0.5 rounded-full">
                              Available
                            </span>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {state.formData.bedId && (
              <button
                type="button"
                onClick={() => dispatch({ type: 'CLEAR_BED' })}
                className="text-xs text-clinic-text/50 hover:text-red-500 mt-1 transition focus:outline-none focus:ring-2 focus:ring-red-500 rounded px-1"
              >
                Clear selection
              </button>
            )}
          </fieldset>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-slate-100 text-clinic-text px-4 py-2.5 rounded-xl hover:bg-slate-200 transition font-medium focus:outline-none focus:ring-2 focus:ring-slate-400"
              disabled={state.submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={state.submitting || state.success}
              className="flex-1 bg-hospital-navy text-white px-4 py-2.5 rounded-xl hover:bg-hospital-navy/90 transition font-medium disabled:opacity-50 flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-hospital-navy focus:ring-offset-2"
              aria-busy={state.submitting}
            >
              {state.submitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                  Admitting...
                </>
              ) : (
                'Admit Patient'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};