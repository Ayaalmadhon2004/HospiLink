import { useCallback, useEffect, useReducer, useRef, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { admitPatient, getAvailableBeds } from '../../../services/patientService';
import { extractList, getResponseData } from '../../../types/api';
import { admitReducer, initialAdmitState, validateAdmitForm, type AdmitFormData, type AvailableBed } from './admitState';

const SUCCESS_DELAY_MS = 800;

interface UseAdmitPatientOptions {
  isOpen: boolean;
  onClose: () => void;
  /** Called once the success message has been shown. */
  onAdd: () => void;
}

/** State and side effects of the admit dialog: free beds of the chosen department, validation, submit, Escape, reset. */
export const useAdmitPatient = ({ isOpen, onClose, onAdd }: UseAdmitPatientOptions) => {
  const { t } = useTranslation();
  const [state, dispatch] = useReducer(admitReducer, initialAdmitState);
  const successTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { department } = state.formData;
  const { submitting } = state;

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && !submitting) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose, submitting]);

  // Free beds: when the dialog opens and whenever the department changes.
  useEffect(() => {
    if (!isOpen) return;
    const controller = new AbortController();
    dispatch({ type: 'FETCH_BEDS_START' });
    getAvailableBeds(department || undefined)
      .then((res) => {
        if (!controller.signal.aborted) dispatch({ type: 'FETCH_BEDS_SUCCESS', beds: extractList<AvailableBed>(res) });
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted) {
          dispatch({ type: 'FETCH_BEDS_ERROR', error: getResponseData(err)?.error || t('patients.admitModal.bedsLoadError') });
        }
      });
    return () => controller.abort();
  }, [isOpen, department, t]);

  // Closing resets the form and cancels a pending "success" callback.
  useEffect(() => {
    if (isOpen) return;
    dispatch({ type: 'RESET_FORM' });
    if (successTimer.current) clearTimeout(successTimer.current);
    successTimer.current = null;
  }, [isOpen]);

  useEffect(() => () => {
    if (successTimer.current) clearTimeout(successTimer.current);
  }, []);

  const setField = useCallback((field: keyof AdmitFormData, value: string) => {
    dispatch({ type: 'SET_FIELD', field, value });
  }, []);

  const clearBed = useCallback(() => dispatch({ type: 'CLEAR_BED' }), []);

  const submit = useCallback(async (event: FormEvent) => {
    event.preventDefault();
    dispatch({ type: 'CLEAR_ERROR' });

    const problem = validateAdmitForm(state.formData);
    if (problem) {
      dispatch({ type: 'SUBMIT_ERROR', error: t(problem) });
      return;
    }

    dispatch({ type: 'SUBMIT_START' });
    try {
      const { name, age, gender, department: dept, diagnosis, bedId } = state.formData;
      await admitPatient({
        name: name.trim(),
        age: Number(age),
        gender,
        department: dept,
        diagnosis: diagnosis.trim(),
        ...(bedId ? { bedId } : {}),
      });
      dispatch({ type: 'SUBMIT_SUCCESS' });
      successTimer.current = setTimeout(onAdd, SUCCESS_DELAY_MS);
    } catch (err: unknown) {
      const body = getResponseData(err);
      dispatch({
        type: 'SUBMIT_ERROR',
        error: body?.message || body?.error || t('patients.admitModal.admitError'),
        details: body?.fullError || body?.error || '',
      });
    }
  }, [state.formData, onAdd, t]);

  return { state, setField, clearBed, submit };
};
