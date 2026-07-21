// components/Form/FormModal.tsx
import { useState, useEffect, useCallback, useRef } from 'react';
import { X, Loader2 } from 'lucide-react';
import { FormBanner } from './FormBanner';
import { FieldRenderer } from './FieldRenderer';
import type { FormModalProps, FieldConfig } from './types';

export const FormModal = <T extends Record<string, any>>({
  isOpen,
  onClose,
  title,
  subtitle,
  fields,
  initialValues,
  onSubmit,
  submitLabel = 'Save',
  submittingLabel = 'Saving...',
  mode = 'create',
}: FormModalProps<T>) => {
  const [values, setValues] = useState<Partial<T>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [formErrorDetail, setFormErrorDetail] = useState('');
  const [success, setSuccess] = useState('');
  const modalRef = useRef<HTMLDivElement>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);

  // Initialize form values
  useEffect(() => {
    if (isOpen) {
      const defaults: Partial<T> = {};
      fields.forEach((field) => {
        if (initialValues && initialValues[field.name] !== undefined) {
          defaults[field.name as keyof T] = initialValues[field.name];
        } else if (field.type === 'checkbox') {
          defaults[field.name as keyof T] = false as any;
        } else {
          defaults[field.name as keyof T] = '' as any;
        }
      });
      setValues(defaults);
      setErrors({});
      setFormError('');
      setFormErrorDetail('');
      setSuccess('');
    }
  }, [isOpen, fields, initialValues]);

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

  const setValue = useCallback((name: string, value: any) => {
    setValues((prev) => ({ ...prev, [name]: value }));
    // Clear error for this field
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
      
      // Required check
      if (field.required) {
        if (value === undefined || value === '' || value === null || value === false) {
          newErrors[field.name] = `${field.label} is required`;
          isValid = false;
        }
      }

      // Type-specific validation
      if (field.type === 'email' && value) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(String(value))) {
          newErrors[field.name] = 'Invalid email address';
          isValid = false;
        }
      }

      if (field.type === 'number' && value) {
        const num = Number(value);
        if (isNaN(num)) {
          newErrors[field.name] = 'Must be a valid number';
          isValid = false;
        }
      }
    });

    setErrors(newErrors);
    return isValid;
  }, [fields, values]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormErrorDetail('');
    setSuccess('');

    if (!validate()) return;

    setSubmitting(true);
    try {
      await onSubmit(values as T);
      setSuccess(mode === 'create' ? 'Created successfully!' : 'Updated successfully!');
      setTimeout(() => {
        onClose();
      }, 800);
    } catch (err: any) {
      console.error('Form submit error:', err);
      const backendError = err.response?.data;
      setFormError(
        backendError?.message || backendError?.error || 'Failed to save. Please try again.'
      );
      setFormErrorDetail(backendError?.fullError || '');
    } finally {
      setSubmitting(false);
    }
  }, [validate, onSubmit, values, onClose, mode]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
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
              {mode === 'edit' ? 'Edit' : 'Add'} {title}
            </h2>
            {subtitle && <p className="text-sm text-clinic-text/50 mt-0.5">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition focus:outline-none focus:ring-2 focus:ring-medical-teal"
            disabled={submitting}
            aria-label="Close modal"
            type="button"
          >
            <X size={20} className="text-clinic-text/50" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4" noValidate>
          <FormBanner
            error={formError}
            errorDetail={formErrorDetail}
            success={success}
          />

          <div className="grid grid-cols-2 gap-4">
            {fields.map((field, index) => (
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
              Cancel
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
                  {submittingLabel}
                </>
              ) : (
                submitLabel
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};