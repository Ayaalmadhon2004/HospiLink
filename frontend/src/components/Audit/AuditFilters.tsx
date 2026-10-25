// components/Audit/AuditFilters.tsx
import { useTranslation } from 'react-i18next';
import type { AuditLogFilters } from '../../services/auditLogService';

interface AuditFiltersProps {
  filters: AuditLogFilters;
  actions: string[];
  onChange: (next: AuditLogFilters) => void;
}

const INPUT = 'border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white';

// <input type="date"> yields a local "YYYY-MM-DD"; the API takes instants. `to` is exclusive, so "to" means the end of that day.
const dayStart = (d: string): string => new Date(`${d}T00:00:00`).toISOString();
const nextDayStart = (d: string): string => {
  const date = new Date(`${d}T00:00:00`);
  date.setDate(date.getDate() + 1);
  return date.toISOString();
};
const toDay = (iso?: string): string => (iso ? new Date(iso).toLocaleDateString('en-CA') : '');

export const AuditFilters = ({ filters, actions, onChange }: AuditFiltersProps) => {
  const { t } = useTranslation();
  const set = (patch: Partial<AuditLogFilters>) => onChange({ ...filters, ...patch });
  const hasFilters = Object.values(filters).some(Boolean);

  return (
    <form className="flex flex-wrap items-end gap-3" onSubmit={(e) => e.preventDefault()}>
      <div className="flex flex-col gap-1">
        <label htmlFor="audit-action" className="text-xs font-medium text-gray-600">{t('audit.filters.action')}</label>
        <select id="audit-action" className={INPUT} value={filters.action ?? ''} onChange={(e) => set({ action: e.target.value || undefined })}>
          <option value="">{t('audit.filters.allActions')}</option>
          {actions.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="audit-from" className="text-xs font-medium text-gray-600">{t('audit.filters.from')}</label>
        <input id="audit-from" type="date" className={INPUT} value={toDay(filters.from)} onChange={(e) => set({ from: e.target.value ? dayStart(e.target.value) : undefined })} />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="audit-to" className="text-xs font-medium text-gray-600">{t('audit.filters.to')}</label>
        <input
          id="audit-to"
          type="date"
          className={INPUT}
          value={filters.to ? toDay(new Date(new Date(filters.to).getTime() - 1).toISOString()) : ''}
          onChange={(e) => set({ to: e.target.value ? nextDayStart(e.target.value) : undefined })}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="audit-entity" className="text-xs font-medium text-gray-600">{t('audit.filters.entityId')}</label>
        <input id="audit-entity" className={INPUT} placeholder={t('audit.filters.entityPlaceholder')} value={filters.entityId ?? ''} onChange={(e) => set({ entityId: e.target.value.trim() || undefined })} />
      </div>
      {hasFilters && (
        <button type="button" onClick={() => onChange({})} className="px-3 py-2 text-sm text-blue-700 underline">
          {t('audit.filters.reset')}
        </button>
      )}
    </form>
  );
};
