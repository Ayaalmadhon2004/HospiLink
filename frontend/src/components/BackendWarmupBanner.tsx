import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useBackendWarmup } from '../hooks/useBackendWarmup';

/** Shown only while the API is cold-starting; disappears as soon as `/api/health` answers. */
export const BackendWarmupBanner = () => {
  const { t } = useTranslation();
  if (useBackendWarmup() !== 'waking') return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-0 inset-x-0 z-50 flex items-center justify-center gap-2 bg-amber-100 text-amber-900 text-sm py-2 px-4 shadow"
    >
      <Loader2 className="animate-spin" size={16} aria-hidden="true" />
      {t('common.serverWaking')}
    </div>
  );
};
