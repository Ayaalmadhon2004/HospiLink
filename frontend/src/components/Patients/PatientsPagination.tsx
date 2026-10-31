import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

const ITEMS_PER_PAGE_OPTIONS = [10, 20, 50] as const;

interface Props {
  page: number;
  limit: number;
  totalPages: number;
  totalCount: number;
  startItem: number;
  endItem: number;
  paginationRange: (number | string)[];
  isFetching: boolean;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
}

export const PatientsPagination = ({
  page, limit, totalPages, totalCount, startItem, endItem, paginationRange, isFetching, onPageChange, onLimitChange,
}: Props) => {
  const { t, i18n } = useTranslation();
  const setPage = onPageChange;
  return (
    <footer className="px-6 py-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-4">
      {/* Info */}
      <div className="text-sm text-slate-500">
        {t('patients.showing', {
          start: startItem.toLocaleString(i18n.language),
          end: endItem.toLocaleString(i18n.language),
          total: totalCount.toLocaleString(i18n.language),
        })}
      </div>

      {/* Items per page */}
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <label htmlFor="rows-per-page">{t('patients.rowsPerPage')}</label>
        <select
          id="rows-per-page"
          value={limit}
          onChange={(e) => onLimitChange(Number(e.target.value))}
          className="border border-slate-200 rounded-lg px-2 py-1 text-sm focus:ring-2 focus:ring-medical-teal outline-none bg-white"
          aria-label={t('patients.rowsPerPageLabel')}
        >
          {ITEMS_PER_PAGE_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      </div>

      {/* Page Navigation */}
      <nav aria-label={t('pagination.label')} className="flex items-center gap-1">
        {/* First */}
        <button
          onClick={() => setPage(1)}
          disabled={page === 1 || isFetching}
          className="p-2 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition focus:outline-none focus:ring-2 focus:ring-medical-teal"
          aria-label={t('pagination.first')}
          title={t('pagination.firstTitle')}
        >
          <ChevronsLeft size={16} className="rtl:rotate-180" aria-hidden="true" />
        </button>

        {/* Previous */}
        <button
          onClick={() => setPage(page - 1)}
          disabled={page === 1 || isFetching}
          className="p-2 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition focus:outline-none focus:ring-2 focus:ring-medical-teal"
          aria-label={t('pagination.previous')}
          title={t('pagination.previousTitle')}
        >
          <ChevronLeft size={16} className="rtl:rotate-180" aria-hidden="true" />
        </button>

        {/* Page Numbers */}
        <div className="flex items-center gap-1 mx-1" role="group" aria-label={t('pagination.pageNumbers')}>
          {paginationRange.map((item, idx) => (
            item === '...' ? (
              <span key={`dots-${idx}`} className="px-2 text-slate-400" aria-hidden="true">...</span>
            ) : (
              <button
                key={item}
                onClick={() => setPage(item as number)}
                disabled={isFetching}
                className={`min-w-[32px] h-8 px-2 rounded-lg text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-medical-teal ${
                  page === item
                    ? 'bg-hospital-navy text-white'
                    : 'text-clinic-text hover:bg-slate-100'
                } disabled:opacity-50`}
                aria-label={t('pagination.goToPage', { page: item })}
                aria-current={page === item ? 'page' : undefined}
              >
                {typeof item === 'number' ? item.toLocaleString(i18n.language) : item}
              </button>
            )
          ))}
        </div>

        {/* Next */}
        <button
          onClick={() => setPage(page + 1)}
          disabled={page === totalPages || isFetching}
          className="p-2 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition focus:outline-none focus:ring-2 focus:ring-medical-teal"
          aria-label={t('pagination.next')}
          title={t('pagination.nextTitle')}
        >
          <ChevronRight size={16} className="rtl:rotate-180" aria-hidden="true" />
        </button>

        {/* Last */}
        <button
          onClick={() => setPage(totalPages)}
          disabled={page === totalPages || isFetching}
          className="p-2 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition focus:outline-none focus:ring-2 focus:ring-medical-teal"
          aria-label={t('pagination.last')}
          title={t('pagination.lastTitle')}
        >
          <ChevronsRight size={16} className="rtl:rotate-180" aria-hidden="true" />
        </button>
      </nav>
    </footer>
  );
};
