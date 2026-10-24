// components/Form/FormModal.tsx
import { useState, useEffect, useCallback, useRef } from 'react';
import { X, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { FormBanner } from './FormBanner';
import { FieldRenderer } from './FieldRenderer';
import { getResponseData } from '../../types/api';
import type { FormModalProps } from './types';

/** Starting values: the initial value when there is one, else an empty value of the field's kind. */
const buildDefaults = <T extends object>(fields: FormModalProps<T>['fields'], initialValues: FormModalProps<T>['initialValues']): Partial<T> => {
  const defaults: Partial<T> = {};
  fields.forEach((field) => {
    if (initialValues && initialValues[field.name] !== undefined && initialValues[field.name] !== null) {
      defaults[field.name as keyof T] = initialValues[field.name];
    } else if (field.type === 'checkbox') {
      defaults[field.name as keyof T] = false as T[keyof T];
    } else if (field.type === 'number') {
      defaults[field.name as keyof T] = undefined as T[keyof T]; // number empty = undefined
    } else {
      defaults[field.name as keyof T] = '' as T[keyof T];
    }
  });
  return defaults;
};

const FormModalBody = <T extends object>({
  isOpen,
  onClose,
  title,
  subtitle,
  fields,
  initialValues,
  onSubmit,
  submitLabel,
  submittingLabel,
  mode = 'create',
}: FormModalProps<T>) => {
  const { t } = useTranslation();
  // Config text may be an i18n key or a plain literal (the literal is the fallback)
  const tr = useCallback((text?: string) => (text ? t(text, { defaultValue: text }) : text), [t]);
  const [values, setValues] = useState<Partial<T>>(() => buildDefaults(fields, initialValues));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [formErrorDetail, setFormErrorDetail] = useState('');
  const [success, setSuccess] = useState('');
  const modalRef = useRef<HTMLDivElement>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);

  // Focus first input
  useEffect(() => {
    if (isOpen && firstInputRef.current) {
      setTimeout(() => firstInputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Escape key handler
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !submitting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose, submitting]);

  const setValue = useCallback((name: string, value: unknown) => {
    setValues((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[name];
      return next;
    });
  }, []);

  const validate = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};
    let isValid = true;

    fields.forEach((field) => {
      const value = values[field.name];

      // Required check — number 0 is NOT empty
      if (field.required) {
        const isEmpty =
          value === undefined ||
          value === '' ||
          value === null ||
          (field.type === 'checkbox' && value === false);

        if (isEmpty) {
          newErrors[field.name] = t('forms.required', { field: tr(field.label) });
          isValid = false;
        }
      }

      // Number validation — only if there's an actual value
      if (field.type === 'number' && value !== undefined && value !== '' && value !== null) {
        const num = Number(value);
        if (isNaN(num)) {
          newErrors[field.name] = t('forms.validNumber');
          isValid = false;
        }
      }

      // Email validation
      if (field.type === 'email' && value) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(String(value))) {
          newErrors[field.name] = t('forms.invalidEmail');
          isValid = false;
        }
      }
    });

    setErrors(newErrors);
    return isValid;
  }, [fields, values, t, tr]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setFormError('');
      setFormErrorDetail('');
      setSuccess('');

      if (!validate()) return;

      setSubmitting(true);
      try {
        // ✅ Clean values — convert '' to undefined before sending to API
        const cleanValues = { ...values };
        fields.forEach((field) => {
          if (cleanValues[field.name] === '') {
            cleanValues[field.name] = undefined;
          }
          // Remove undefined number fields from payload
          if (field.type === 'number' && cleanValues[field.name] === undefined) {
            delete cleanValues[field.name];
          }
        });

        await onSubmit(cleanValues as T);
        setSuccess(mode === 'create' ? t('forms.created') : t('forms.updated'));
        setTimeout(() => {
          onClose();
        }, 800);
      } catch (err: unknown) {
        const backendError = getResponseData(err);
        setFormError(
          backendError?.message || backendError?.error || t('forms.saveFailed')
        );
        setFormErrorDetail(backendError?.fullError || '');
      } finally {
        setSubmitting(false);
      }
    },
    [validate, onSubmit, values, onClose, mode, fields, t]
  );

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-hospital-navy/50 flex items-center justify-center z-50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="form-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <div
        ref={modalRef}
        className="bg-white rounded-2xl w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100 sticky top-0 bg-white rounded-t-2xl z-10">
          <div>
            <h2 id="form-modal-title" className="text-xl font-bold text-hospital-navy">
              {t(mode === 'edit' ? 'forms.editTitle' : 'forms.addTitle', { title: tr(title) })}
            </h2>
            {subtitle && <p className="text-sm text-clinic-text/50 mt-0.5">{tr(subtitle)}</p>}
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition focus:outline-none focus:ring-2 focus:ring-medical-teal"
            disabled={submitting}
            aria-label={t('common.closeModal')}
            type="button"
          >
            <X size={20} className="text-clinic-text/50" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4" noValidate>
          <FormBanner error={formError} errorDetail={formErrorDetail} success={success} />

          <div className="grid grid-cols-2 gap-4">
            {fields.map((field) => (
              <FieldRenderer<T>
                key={field.name}
                field={field}
                value={values[field.name]}
                setValue={setValue}
                formValues={values as T}
                error={errors[field.name]}
                disabled={submitting || success !== ''}
              />
            ))}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-slate-100 text-clinic-text px-4 py-2.5 rounded-xl hover:bg-slate-200 transition font-medium focus:outline-none focus:ring-2 focus:ring-slate-400"
              disabled={submitting}
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={submitting || success !== ''}
              className="flex-1 bg-hospital-navy text-white px-4 py-2.5 rounded-xl hover:bg-hospital-navy/90 transition font-medium disabled:opacity-50 flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-hospital-navy focus:ring-offset-2"
              aria-busy={submitting}
            >
              {submitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                  {tr(submittingLabel) ?? t('common.saving')}
                </>
              ) : (
                (tr(submitLabel) ?? t('common.save'))
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/** Mounts the form only while open, so every opening starts from fresh values (no reset effect needed). */
export const FormModal = <T extends object>(props: FormModalProps<T>) =>
  props.isOpen ? <FormModalBody<T> {...props} /> : null;
