import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

export const ADMIT_INPUT_CLASS =
  'w-full border border-slate-200 px-4 py-2.5 rounded-xl focus:ring-2 focus:ring-medical-teal focus:border-medical-teal outline-none transition';

interface AdmitFieldProps {
  id: string;
  label: string;
  children: ReactNode;
}

/** Label + control of one required field of the admit form. */
export const AdmitField = ({ id, label, children }: AdmitFieldProps) => {
  const { t } = useTranslation();
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-clinic-text mb-1">
        {label} <span className="text-red-500" aria-hidden="true">*</span>
        <span className="sr-only"> ({t('common.required')})</span>
      </label>
      {children}
    </div>
  );
};
