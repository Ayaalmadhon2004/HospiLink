// pages/AuditLogsPage.tsx
import { useTranslation } from 'react-i18next';
import { ScrollText } from 'lucide-react';
import { AuditFilters } from '../components/Audit/AuditFilters';
import { AuditTable } from '../components/Audit/AuditTable';
import { useAuditLogs } from '../hooks/useAuditLogs';

export const AuditLogsPage = () => {
  const { t } = useTranslation();
  const { filters, setFilters, page, setPage, logs, actions } = useAuditLogs();
  const pagination = logs.data?.pagination;

  return (
    <div className="space-y-6 p-4 md:p-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <ScrollText className="w-6 h-6 text-blue-600" aria-hidden="true" />
          {t('audit.title')}
        </h1>
        <p className="text-gray-500 text-sm mt-1">{t('audit.subtitle')}</p>
      </div>

      <AuditFilters filters={filters} actions={actions} onChange={setFilters} />

      {logs.isError ? (
        <div role="alert" className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 flex items-center justify-between">
          <span>{t('audit.loadFailed')}</span>
          <button onClick={() => logs.refetch()} className="font-medium underline">{t('audit.retry')}</button>
        </div>
      ) : logs.isPending ? (
        <div className="flex justify-center h-32 items-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" role="status" aria-label={t('audit.loading')} />
        </div>
      ) : (
        <AuditTable items={logs.data.items} />
      )}

      {pagination && pagination.totalCount > 0 && (
        <nav className="flex items-center justify-between text-sm text-gray-600" aria-label={t('audit.title')}>
          <span>{t('audit.total', { count: pagination.totalCount })} · {t('audit.page', { page: pagination.page, total: pagination.totalPages })}</span>
          <div className="flex gap-2">
            <button onClick={() => setPage(page - 1)} disabled={!pagination.hasPrevPage} className="px-3 py-1.5 rounded-lg border border-gray-300 disabled:opacity-40">
              {t('audit.prev')}
            </button>
            <button onClick={() => setPage(page + 1)} disabled={!pagination.hasNextPage} className="px-3 py-1.5 rounded-lg border border-gray-300 disabled:opacity-40">
              {t('audit.next')}
            </button>
          </div>
        </nav>
      )}
    </div>
  );
};
