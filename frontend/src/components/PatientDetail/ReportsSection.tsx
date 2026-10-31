import { useTranslation } from 'react-i18next';
import { FileText, Download } from 'lucide-react';
import { api } from '../../services/api';
import type { PatientReport } from '../../types/patient';
import { formatDate } from '../../utils/datetime';

// /uploads is protected: fetch the file with auth (Bearer/cookie) and open it as a blob URL
const openReportFile = async (fileUrl: string): Promise<void> => {
  const base = String(api.defaults.baseURL ?? '').replace(/\/api\/?$/, '');
  const res = await api.get(`${base}${fileUrl}`, { responseType: 'blob' });
  const blobUrl = URL.createObjectURL(res.data as Blob);
  window.open(blobUrl, '_blank', 'noopener');
  setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
};

interface Props {
  reports: PatientReport[];
  loading: boolean;
  onOpenError: (message: string) => void;
}

export const ReportsSection = ({ reports, loading, onOpenError }: Props) => {
  const { t } = useTranslation();
  return (
    <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6">
      <h2 className="text-lg font-bold text-hospital-navy mb-4 flex items-center gap-2">
        <FileText size={20} className="text-medical-teal" aria-hidden="true" />
        {t('patientDetail.reports', { count: reports.length })}
      </h2>

      {loading ? (
        <div className="text-clinic-text/40 text-sm">{t('patientDetail.loadingReports')}</div>
      ) : reports.length === 0 ? (
        <p className="text-clinic-text/40 text-sm">{t('patientDetail.noReports')}</p>
      ) : (
        <ul className="space-y-2" role="list" aria-label={t('patientDetail.reportsLabel')}>
          {reports.map((report) => (
            <li key={report.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition">
              <FileText size={16} className="text-medical-teal" aria-hidden="true" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-clinic-text truncate">{report.fileName}</p>
                <p className="text-xs text-clinic-text/40">
                  <time dateTime={report.createdAt}>
                    {formatDate(report.createdAt)}
                  </time>
                  {' • '}
                  {report.fileType.split('/')[1].toUpperCase()}
                </p>
              </div>
              <button
                type="button"
                onClick={() => { openReportFile(report.fileUrl).catch(() => onOpenError(t('patientDetail.openReportError'))); }}
                className="text-medical-teal hover:underline text-sm flex items-center gap-1"
                aria-label={t('patientDetail.viewReport', { name: report.fileName })}
              >
                <Download size={14} aria-hidden="true" />
                {t('patientDetail.view')}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
