// components/Form/types.ts
import type { ReactNode } from 'react';
import type { ZodTypeAny } from 'zod';

// ─── Field Types ───────────────────────────────────────────────────
export type FieldType =
  | 'text'
  | 'email'
  | 'password'
  | 'number'
  | 'tel'
  | 'date'
  | 'time'
  | 'datetime-local'
  | 'select'
  | 'textarea'
  | 'radio'
  | 'checkbox'
  | 'search-select'
  | 'custom';

export interface SelectOption {
  label: string;
  value: string;
}

export interface FieldConfig<T = Record<string, unknown>> {
  name: keyof T & string;
  label: string;
  type: FieldType;
  placeholder?: string;
  required?: boolean;
  options?: SelectOption[];           // for select / radio
  apiEndpoint?: string;               // for search-select (fetch options from API)
  dependsOn?: string;               // field name this depends on (e.g., bed list depends on department)
  colSpan?: 1 | 2;                  // 1 = half width, 2 = full width
  rows?: number;                    // for textarea
  step?: number | 'any';            // for number inputs (default 1: a price needs 0.01 or 'any', or the browser blocks the submit)
  disabled?: boolean | ((formValues: T) => boolean);
  helperText?: string;
  validation?: ZodTypeAny;          // per-field Zod override
  render?: (props: {
    value: unknown;
    setValue: (name: string, value: unknown) => void;
    formValues: T;
  }) => ReactNode;                   // for custom fields
}

// ─── Entity Config ─────────────────────────────────────────────────
export interface EntityApiEndpoints {
  create: string;
  update: string;
  delete: string;
  getById?: string;
}

export interface EntityConfig<T = Record<string, unknown>> {
  entityType: string;
  title: string;
  subtitle: string;
  fields: FieldConfig<T>[];
  apiEndpoints: EntityApiEndpoints;
  validationSchema?: ZodTypeAny;     // optional: full form Zod schema
  transformSubmit?: (values: T) => unknown; // transform values before API call
}

// ─── Form Modal Props ──────────────────────────────────────────────
export interface FormModalProps<T = Record<string, unknown>> {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  fields: FieldConfig<T>[];
  initialValues?: Partial<T>;
  onSubmit: (values: T) => Promise<void>;
  submitLabel?: string;
  submittingLabel?: string;
  mode?: 'create' | 'edit';
}

// ─── Confirm Modal Props ───────────────────────────────────────────
export interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  confirmingLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'primary' | 'neutral';
}