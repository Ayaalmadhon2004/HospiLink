// components/Form/Combobox.tsx
import { useId, useMemo, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export interface ComboboxOption {
  label: string;
  value: string;
  /** Secondary searchable text, e.g. patient code (PT-2064) */
  hint?: string;
}

interface ComboboxProps {
  options: ComboboxOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Label for the empty ("clear") choice; omit to hide it */
  clearLabel?: string;
  disabled?: boolean;
  loading?: boolean;
  /** Overrides the default "no options" text */
  emptyMessage?: string;
  /** Free-text mode: parent owns the typed text and does any (e.g. server-side) filtering */
  query?: string;
  onQueryChange?: (query: string) => void;
  id?: string;
  className?: string;
}

export const Combobox = ({
  options, value, onChange, placeholder, clearLabel, disabled, loading, emptyMessage, query: freeQuery = '', onQueryChange, id, className = '',
}: ComboboxProps) => {
  const { t, i18n } = useTranslation();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);

  const selected = options.find((o) => o.value === value);
  const freeText = onQueryChange !== undefined;
  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q && !freeText
      ? options.filter((o) => `${o.label} ${o.hint ?? ''}`.toLowerCase().includes(q))
      : options;
    return clearLabel ? [{ label: clearLabel, value: '' }, ...list] : list;
  }, [options, query, clearLabel, freeText]);

  let emptyText = '';
  if (loading) emptyText = t('common.loading');
  else if (items.length === 0) emptyText = freeText ? emptyMessage ?? '' : emptyMessage ?? t('forms.noOptions');

  let inputValue = selected?.label ?? '';
  if (open) inputValue = query;
  if (freeText) inputValue = freeQuery;

  const close = () => { setOpen(false); setQuery(''); };
  const pick = (v: string) => { onChange(v); close(); };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) { setOpen(true); return; }
      const step = e.key === 'ArrowDown' ? 1 : -1;
      setActive((i) => (i + step + items.length) % Math.max(items.length, 1));
    } else if (e.key === 'Enter' && open) {
      e.preventDefault();
      if (items[active]) pick(items[active].value);
    } else if (e.key === 'Escape' && open) {
      e.stopPropagation();
      close();
    }
  };

  return (
    <div className={`relative ${className}`} dir={i18n.dir()}>
      <input
        ref={inputRef}
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && items[active] ? `${listId}-${active}` : undefined}
        disabled={disabled}
        autoComplete="off"
        value={inputValue}
        placeholder={placeholder}
        onFocus={() => { setOpen(true); setActive(0); }}
        onChange={(e) => {
          if (freeText) onQueryChange(e.target.value);
          else setQuery(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onKeyDown={onKeyDown}
        onBlur={close}
        className="w-full ps-4 pe-9 py-2.5 border border-slate-200 rounded-xl text-sm bg-white text-slate-800 placeholder:text-slate-400 outline-none transition focus:border-medical-teal focus:ring-2 focus:ring-medical-teal/20 disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed"
      />
      <ChevronDown aria-hidden="true" size={16} className="pointer-events-none absolute end-3 top-3.5 text-slate-400" />
      {open && (emptyText || items.length > 0) && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-60 overflow-y-auto py-1"
        >
          {emptyText && <li className="px-4 py-3 text-sm text-slate-400">{emptyText}</li>}
          {!emptyText &&
            items.map((o, i) => (
              <li
                key={o.value || '__clear'}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={o.value === value}
                ref={(el) => { if (el && i === active) el.scrollIntoView?.({ block: 'nearest' }); }}
                onMouseDown={(e) => { e.preventDefault(); pick(o.value); }}
                onMouseEnter={() => setActive(i)}
                className={`flex items-center justify-between gap-3 px-4 py-2 text-sm cursor-pointer transition-colors ${
                  i === active ? 'bg-slate-100' : ''
                } ${o.value === value ? 'text-medical-teal font-medium' : 'text-slate-800'}`}
              >
                <span className="truncate">{o.label}</span>
                {o.hint && <span className="text-xs text-slate-400 shrink-0">{o.hint}</span>}
              </li>
            ))}
        </ul>
      )}
    </div>
  );
};
