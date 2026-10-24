import { useTranslation } from 'react-i18next';

export const LoadingSpinner = () => {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-center py-12" role="status" aria-label={t('common.loading')}>
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600" />
      <span className="sr-only">{t('dashboard.loadingData')}</span>
    </div>
  );
};

export const ErrorBanner = ({ message, onRetry }: { message: string; onRetry: () => void }) => {
  const { t } = useTranslation();
  return (
    <div
      className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center justify-between"
      role="alert"
      aria-live="polite"
    >
      <span className="text-sm font-medium">{message}</span>
      <button
        onClick={onRetry}
        className="text-sm font-semibold underline hover:no-underline focus:outline-none focus:ring-2 focus:ring-red-500 rounded px-2"
        aria-label={t('dashboard.retryLabel')}
      >
        {t('common.retry')}
      </button>
    </div>
  );
};

export const EmptyState = ({ message }: { message: string }) => (
  <div className="text-center py-6 text-gray-400">
    <p className="text-sm">{message}</p>
  </div>
);
