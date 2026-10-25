// components/Export/ExportMenu.tsx
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Download, FileSpreadsheet, FileText } from 'lucide-react';
import { useAuthPermissions } from '../../hooks/useAuthPermissions';
import { downloadExport, type ExportFormat, type ExportType } from '../../services/exportService';
import { dayStartIso, nextDayStartIso } from '../../utils/dateRange';
import { getErrorMessage } from '../../types/api';
import { ApiError } from '../../services/apiError';

const HTTP_TOO_LARGE = 413;
const INPUT = 'border border-gray-300 rounded-lg px-2 py-1.5 text-sm w-full bg-white';

/** "Export" button with a period picker and Excel / PDF choices. Renders nothing for roles the server would refuse. */
export const ExportMenu = ({ type }: { type: ExportType }) => {
  const { t } = useTranslation();
  const { can } = useAuthPermissions();
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [busy, setBusy] = useState<ExportFormat | null>(null);

  if (!can(type === 'billing' ? 'export:billing' : 'export:clinical')) return null;
  const invalid = !!from && !!to && from > to;

  const run = async (format: ExportFormat) => {
    setBusy(format);
    try {
      await downloadExport(type, format, { from: from ? dayStartIso(from) : undefined, to: to ? nextDayStartIso(to) : undefined });
      setOpen(false);
    } catch (err: unknown) {
      toast.error(err instanceof ApiError && err.status === HTTP_TOO_LARGE ? t('export.tooLarge') : getErrorMessage(err, t('export.failed')));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 bg-white text-gray-700 px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition text-sm font-medium"
      >
        <Download className="w-4 h-4" aria-hidden="true" />
        {t('export.button')}
      </button>
      {open && (
        <div role="dialog" aria-label={t('export.title')} className="absolute end-0 z-30 mt-2 w-72 bg-white border border-slate-200 rounded-xl shadow-lg p-4 space-y-3">
          <p className="text-xs text-gray-500">{t('export.hint')}</p>
          <div className="grid grid-cols-2 gap-2">
            <div><label htmlFor={`exp-from-${type}`} className="text-xs font-medium text-gray-600">{t('audit.filters.from')}</label>
              <input id={`exp-from-${type}`} type="date" className={INPUT} value={from} onChange={(e) => setFrom(e.target.value)} /></div>
            <div><label htmlFor={`exp-to-${type}`} className="text-xs font-medium text-gray-600">{t('audit.filters.to')}</label>
              <input id={`exp-to-${type}`} type="date" className={INPUT} value={to} onChange={(e) => setTo(e.target.value)} /></div>
          </div>
          {invalid && <p role="alert" className="text-xs text-red-700">{t('export.badRange')}</p>}
          <div className="flex gap-2">
            <button type="button" disabled={busy !== null || invalid} onClick={() => void run('xlsx')} className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-600 text-white py-2 rounded-lg text-sm disabled:opacity-50">
              <FileSpreadsheet className="w-4 h-4" aria-hidden="true" />{busy === 'xlsx' ? t('export.preparing') : t('export.excel')}
            </button>
            <button type="button" disabled={busy !== null || invalid} onClick={() => void run('pdf')} className="flex-1 flex items-center justify-center gap-1.5 bg-red-600 text-white py-2 rounded-lg text-sm disabled:opacity-50">
              <FileText className="w-4 h-4" aria-hidden="true" />{busy === 'pdf' ? t('export.preparing') : t('export.pdf')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
