// components/Form/FieldRenderer.tsx
import { useState, useEffect, useCallback } from 'react';
import { Search, ChevronDown, X } from 'lucide-react';
import { apiGet } from '../../services/api';
import type { FieldConfig } from './types';

interface FieldRendererProps<T = any> {
  field: FieldConfig<T>;
  value: any;
  setValue: (name: string, value: any) => void;
  formValues: T;
  error?: string;
  disabled?: boolean;
}

export const FieldRenderer = <T extends Record<string, any>>({
  field,
  value,
  setValue,
  formValues,
  error,
  disabled: formDisabled,
}: FieldRendererProps<T>) => {
  const [searchOptions, setSearchOptions] = useState<{ label: string; value: string }[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);

  // Handle dependent field fetching
  const fetchDependentOptions = useCallback(async () => {
    if (!field.apiEndpoint || !field.dependsOn) return;
    
    const parentValue = formValues[field.dependsOn as keyof T];
    if (!parentValue) {
      setSearchOptions([]);
      return;
    }

    setSearchLoading(true);
    try {
      const endpoint = field.apiEndpoint.replace(`{${field.dependsOn}}`, String(parentValue));
      const res = await apiGet(endpoint);
      const data = res.data?.data || res.data || [];
      setSearchOptions(
        data.map((item: any) => ({
          label: item.name || item.bedNumber || item.label || String(item),
          value: item.id || item.value || String(item),
        }))
      );
    } catch (err) {
      console.error('Failed to fetch options:', err);
      setSearchOptions([]);
    } finally {
      setSearchLoading(false);
    }
  }, [field.apiEndpoint, field.dependsOn, formValues]);

  useEffect(() => {
    if (field.type === 'search-select' && field.dependsOn) {
      fetchDependentOptions();
    }
  }, [fetchDependentOptions, field.type]);

  // Compute disabled state
  const isDisabled =
    formDisabled ||
    (typeof field.disabled === 'function'
      ? field.disabled(formValues)
      : field.disabled);

  const baseInputClass = `
    w-full px-4 py-2.5 border rounded-xl text-sm outline-none transition
    ${error ? 'border-red-300 focus:border-red-500 focus:ring-2 focus:ring-red-200' : 'border-slate-200 focus:border-medical-teal focus:ring-2 focus:ring-medical-teal/20'}
    ${isDisabled ? 'bg-slate-50 text-slate-400 cursor-not-allowed' : 'bg-white text-clinic-text'}
  `;

  const labelClass = "block text-sm font-medium text-clinic-text mb-1.5";
  const helperClass = "text-xs text-clinic-text/40 mt-1";
  const errorClass = "text-xs text-red-500 mt-1";

  // ─── Custom Field ────────────────────────────────────────────────
  if (field.type === 'custom' && field.render) {
    return (
      <div className={field.colSpan === 2 ? 'col-span-2' : 'col-span-1'}>
        {field.label && (
          <label className={labelClass}>
            {field.label}
            {field.required && <span className="text-red-500 ml-0.5">*</span>}
          </label>
        )}
        {field.render({ value, setValue, formValues })}
        {field.helperText && <p className={helperClass}>{field.helperText}</p>}
        {error && <p className={errorClass}>{error}</p>}
      </div>
    );
  }

  // ─── Search Select ───────────────────────────────────────────────
  if (field.type === 'search-select') {
    const selectedOption = searchOptions.find((o) => o.value === value) || 
      (field.options?.find((o) => o.value === value));

    return (
      <div className={field.colSpan === 2 ? 'col-span-2' : 'col-span-1'}>
        <label className={labelClass}>
          {field.label}
          {field.required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
        <div className="relative">
          <button
            type="button"
            onClick={() => !isDisabled && setShowDropdown(!showDropdown)}
            className={`${baseInputClass} text-left flex items-center justify-between`}
            disabled={isDisabled}
          >
            <span className={value ? 'text-clinic-text' : 'text-slate-400'}>
              {selectedOption?.label || field.placeholder || 'Select...'}
            </span>
            <ChevronDown size={16} className={`text-slate-400 transition ${showDropdown ? 'rotate-180' : ''}`} />
          </button>

          {showDropdown && (
            <>
              <div
                className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                {field.dependsOn && !formValues[field.dependsOn as keyof T] ? (
                  <div className="px-4 py-3 text-sm text-slate-400">
                    Please select {field.dependsOn} first
                  </div>
                ) : searchLoading ? (
                  <div className="px-4 py-3 text-sm text-slate-400">Loading...</div>
                ) : searchOptions.length === 0 && !field.options ? (
                  <div className="px-4 py-3 text-sm text-slate-400">No options available</div>
                ) : (
                  <>
                    {(field.options || searchOptions).map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => {
                          setValue(field.name, option.value);
                          setShowDropdown(false);
                        }}
                        className={`w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 transition ${
                          value === option.value ? 'bg-medical-teal/5 text-medical-teal' : 'text-clinic-text'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </>
                )}
              </div>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowDropdown(false)}
              />
            </>
          )}
        </div>
        {field.helperText && <p className={helperClass}>{field.helperText}</p>}
        {error && <p className={errorClass}>{error}</p>}
      </div>
    );
  }

  // ─── Select ──────────────────────────────────────────────────────
  if (field.type === 'select') {
    return (
      <div className={field.colSpan === 2 ? 'col-span-2' : 'col-span-1'}>
        <label className={labelClass}>
          {field.label}
          {field.required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
        <select
          value={value || ''}
          onChange={(e) => setValue(field.name, e.target.value)}
          disabled={isDisabled}
          className={`${baseInputClass} appearance-none bg-white`}
        >
          <option value="">{field.placeholder || `Select ${field.label}`}</option>
          {field.options?.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {field.helperText && <p className={helperClass}>{field.helperText}</p>}
        {error && <p className={errorClass}>{error}</p>}
      </div>
    );
  }

  // ─── Textarea ────────────────────────────────────────────────────
  if (field.type === 'textarea') {
    return (
      <div className={field.colSpan === 2 ? 'col-span-2' : 'col-span-1'}>
        <label className={labelClass}>
          {field.label}
          {field.required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
        <textarea
          value={value || ''}
          onChange={(e) => setValue(field.name, e.target.value)}
          placeholder={field.placeholder}
          rows={field.rows || 3}
          disabled={isDisabled}
          className={`${baseInputClass} resize-none`}
        />
        {field.helperText && <p className={helperClass}>{field.helperText}</p>}
        {error && <p className={errorClass}>{error}</p>}
      </div>
    );
  }

  // ─── Radio ───────────────────────────────────────────────────────
  if (field.type === 'radio') {
    return (
      <div className={field.colSpan === 2 ? 'col-span-2' : 'col-span-1'}>
        <label className={labelClass}>
          {field.label}
          {field.required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
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
              <span className="text-sm">{opt.label}</span>
            </label>
          ))}
        </div>
        {field.helperText && <p className={helperClass}>{field.helperText}</p>}
        {error && <p className={errorClass}>{error}</p>}
      </div>
    );
  }

  // ─── Checkbox ────────────────────────────────────────────────────
  if (field.type === 'checkbox') {
    return (
      <div className={field.colSpan === 2 ? 'col-span-2' : 'col-span-1'}>
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={!!value}
            onChange={(e) => setValue(field.name, e.target.checked)}
            disabled={isDisabled}
            className="w-4 h-4 rounded border-slate-300 text-medical-teal focus:ring-medical-teal"
          />
          <span className="text-sm text-clinic-text">
            {field.label}
            {field.required && <span className="text-red-500 ml-0.5">*</span>}
          </span>
        </label>
        {field.helperText && <p className={helperClass}>{field.helperText}</p>}
        {error && <p className={errorClass}>{error}</p>}
      </div>
    );
  }

  // ─── Default: text, email, number, tel, date, time, etc. ─────────
  const inputType = field.type === 'datetime-local' ? 'datetime-local' : field.type;

  return (
    <div className={field.colSpan === 2 ? 'col-span-2' : 'col-span-1'}>
      <label className={labelClass}>
        {field.label}
        {field.required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input
        type={inputType}
        value={value || ''}
        onChange={(e) => setValue(field.name, e.target.value)}
        placeholder={field.placeholder}
        disabled={isDisabled}
        className={baseInputClass}
        min={field.type === 'number' ? 0 : undefined}
        max={field.type === 'number' ? 99999 : undefined}
      />
      {field.helperText && <p className={helperClass}>{field.helperText}</p>}
      {error && <p className={errorClass}>{error}</p>}
    </div>
  );
};