// components/Form/FieldRenderer.tsx
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { apiGet } from '../../services/api';
import { extractList } from '../../types/api';
import type { FieldConfig } from './types';
import { Combobox } from './Combobox';

interface SearchOption {
  label: string;
  value: string;
  hint?: string;
}

interface FieldRendererProps<T = Record<string, unknown>> {
  field: FieldConfig<T>;
  value: unknown;
  setValue: (name: string, value: unknown) => void;
  formValues: T;
  error?: string;
  disabled?: boolean;
}

export const FieldRenderer = <T extends object>({
  field,
  value,
  setValue,
  formValues,
  error,
  disabled: formDisabled,
}: FieldRendererProps<T>) => {
  const { t } = useTranslation();
  // Config text may be an i18n key or a plain literal (literal is the fallback)
  const tr = (text?: string) => (text ? t(text, { defaultValue: text }) : text);

  // search-select: options come from `apiEndpoint`; with `dependsOn` the endpoint is only called once the parent has a value
  const parentValue = field.dependsOn ? formValues[field.dependsOn as keyof T] : undefined;
  const optionsEndpoint =
    field.type === 'search-select' && field.apiEndpoint && (!field.dependsOn || parentValue)
      ? field.apiEndpoint.replace(`{${field.dependsOn}}`, String(parentValue))
      : null;
  const { data: searchOptions = [], isFetching: searchLoading } = useQuery({
    queryKey: ['field-options', optionsEndpoint],
    queryFn: async (): Promise<SearchOption[]> =>
      extractList<Record<string, string>>(await apiGet(optionsEndpoint as string)).map((item) => ({
        label: item.name || item.fullName || item.bedNumber || item.label || item.code || String(item),
        value: item.id || item.value || String(item),
        hint: item.patientCode,
      })),
    enabled: optionsEndpoint !== null,
    retry: false,
    staleTime: 0,
  });

  const isDisabled =
    formDisabled ||
    (typeof field.disabled === 'function' ? field.disabled(formValues) : field.disabled);

  const baseInputClass = `w-full px-4 py-2.5 border rounded-xl text-sm outline-none transition ${
    error
      ? 'border-red-300 focus:border-red-500 focus:ring-2 focus:ring-red-200'
      : 'border-slate-200 focus:border-medical-teal focus:ring-2 focus:ring-medical-teal/20'
  } ${
    isDisabled
      ? 'bg-slate-50 text-slate-400 cursor-not-allowed'
      : 'bg-white text-clinic-text'
  }`;

  const labelClass = 'block text-sm font-medium text-clinic-text mb-1.5';
  const helperClass = 'text-xs text-clinic-text/40 mt-1';
  const errorClass = 'text-xs text-red-500 mt-1';
  const colSpan = field.colSpan === 2 ? 'col-span-2' : 'col-span-1';

  const renderLabel = () => (
    <label className={labelClass}>
      {tr(field.label)}
      {field.required && <span className="text-red-500 ms-0.5">*</span>}
    </label>
  );

  if (field.type === 'custom' && field.render) {
    return (
      <div className={colSpan}>
        {field.label && renderLabel()}
        {field.render({ value, setValue, formValues })}
        {field.helperText && <p className={helperClass}>{tr(field.helperText)}</p>}
        {error && <p className={errorClass}>{error}</p>}
      </div>
    );
  }

  if (field.type === 'search-select') {
    const allOptions = field.options || searchOptions;
    const blocked = !!field.dependsOn && !formValues[field.dependsOn as keyof T];

    return (
      <div className={colSpan}>
        {renderLabel()}
        <Combobox
          options={blocked ? [] : allOptions.map((o) => ({ ...o, label: tr(o.label) ?? o.label }))}
          value={(value as string) || ''}
          onChange={(v) => setValue(field.name, v)}
          placeholder={tr(field.placeholder) || t('forms.select')}
          loading={searchLoading}
          emptyMessage={
            blocked
              ? t('forms.selectFirst', { field: t(`forms.fields.${field.dependsOn}`, { defaultValue: field.dependsOn }) })
              : undefined
          }
          disabled={isDisabled}
        />
        {field.helperText && <p className={helperClass}>{tr(field.helperText)}</p>}
        {error && <p className={errorClass}>{error}</p>}
      </div>
    );
  }

  if (field.type === 'select') {
    return (
      <div className={colSpan}>
        {renderLabel()}
        <select
          value={(value as string) || ''}
          onChange={(e) => setValue(field.name, e.target.value)}
          disabled={isDisabled}
          className={`${baseInputClass} appearance-none bg-white`}
        >
          <option value="">{tr(field.placeholder) || t('forms.selectField', { label: tr(field.label) })}</option>
          {field.options?.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {tr(opt.label)}
            </option>
          ))}
        </select>
        {field.helperText && <p className={helperClass}>{tr(field.helperText)}</p>}
        {error && <p className={errorClass}>{error}</p>}
      </div>
    );
  }

  if (field.type === 'textarea') {
    return (
      <div className={colSpan}>
        {renderLabel()}
        <textarea
          value={(value as string) || ''}
          onChange={(e) => setValue(field.name, e.target.value)}
          placeholder={tr(field.placeholder)}
          rows={field.rows || 3}
          disabled={isDisabled}
          className={`${baseInputClass} resize-none`}
        />
        {field.helperText && <p className={helperClass}>{tr(field.helperText)}</p>}
        {error && <p className={errorClass}>{error}</p>}
      </div>
    );
  }

  if (field.type === 'radio') {
    return (
      <div className={colSpan}>
        {renderLabel()}
        <div className="flex flex-wrap gap-3">
          {field.options?.map((opt) => (
            <label
              key={opt.value}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition ${
                value === opt.value
                  ? 'border-medical-teal bg-medical-teal/5 text-medical-teal'
                  : 'border-slate-200 hover:bg-slate-50'
              }`}
            >
              <input
                type="radio"
                name={field.name}
                value={opt.value}
                checked={value === opt.value}
                onChange={() => setValue(field.name, opt.value)}
                disabled={isDisabled}
                className="w-4 h-4 text-medical-teal"
              />
              <span className="text-sm">{tr(opt.label)}</span>
            </label>
          ))}
        </div>
        {field.helperText && <p className={helperClass}>{tr(field.helperText)}</p>}
        {error && <p className={errorClass}>{error}</p>}
      </div>
    );
  }

  if (field.type === 'checkbox') {
    return (
      <div className={colSpan}>
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={!!value}
            onChange={(e) => setValue(field.name, e.target.checked)}
            disabled={isDisabled}
            className="w-4 h-4 rounded border-slate-300 text-medical-teal focus:ring-medical-teal"
          />
          <span className="text-sm text-clinic-text">
            {tr(field.label)}
            {field.required && <span className="text-red-500 ms-0.5">*</span>}
          </span>
        </label>
        {field.helperText && <p className={helperClass}>{tr(field.helperText)}</p>}
        {error && <p className={errorClass}>{error}</p>}
      </div>
    );
  }

  // Default: text, email, password, number, tel, date, time, datetime-local
  const inputType = field.type === 'datetime-local' ? 'datetime-local' : field.type;

  // ✅ FIX: number 0 is NOT empty string
  const inputValue =
    field.type === 'number'
      ? value === undefined || value === null
        ? ''
        : String(value)
      : (value as string) || '';

  return (
    <div className={colSpan}>
      {renderLabel()}
      <input
        type={inputType}
        value={inputValue}
        onChange={(e) => {
          const raw = e.target.value;
          if (field.type === 'number') {
            // ✅ Send undefined if empty, Number if value exists
            setValue(field.name, raw === '' ? undefined : Number(raw));
          } else {
            setValue(field.name, raw);
          }
        }}
        placeholder={tr(field.placeholder)}
        disabled={isDisabled}
        className={baseInputClass}
        min={field.type === 'number' ? 0 : undefined}
        max={field.type === 'number' ? 99999 : undefined}
      />
      {field.helperText && <p className={helperClass}>{tr(field.helperText)}</p>}
      {error && <p className={errorClass}>{error}</p>}
    </div>
  );
};