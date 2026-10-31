import { memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react';
import { formatDate } from '../../utils/datetime';
import { enumLabel } from '../../utils/enumLabel';

const STATUS_COLORS: Record<string, string> = {
  STABLE: 'bg-green-100 text-green-700',
  OBSERVATION: 'bg-yellow-100 text-yellow-700',
  CRITICAL: 'bg-red-100 text-red-700',
  DISCHARGED: 'bg-gray-100 text-gray-500',
};

export interface PatientRow {
  id: string;
  patientCode: string;
  name: string;
  age: number;
  gender: string;
  department: string;
  diagnosis?: string;
  status: string;
  admissionDate: string;
  dischargeDate?: string;
  bedId?: string | null;
  bed?: {
    bedNumber: string;
    ward: { name: string };
  } | null;
}

// ─── Skeleton Row ─────────────────────────────────────────────────
const SkeletonRow = memo(() => (
  <tr className="animate-pulse">
    <td className="px-6 py-4"><div className="h-4 w-20 bg-slate-200 rounded" /></td>
    <td className="px-6 py-4"><div className="h-4 w-28 bg-slate-200 rounded" /></td>
    <td className="px-6 py-4"><div className="h-4 w-10 bg-slate-200 rounded" /></td>
    <td className="px-6 py-4"><div className="h-4 w-24 bg-slate-200 rounded" /></td>
    <td className="px-6 py-4"><div className="h-4 w-24 bg-slate-200 rounded" /></td>
    <td className="px-6 py-4"><div className="h-6 w-20 bg-slate-200 rounded-full" /></td>
  </tr>
));
SkeletonRow.displayName = 'SkeletonRow';

// ─── Status Badge ─────────────────────────────────────────────────
const StatusBadge = memo(({ status }: { status: string }) => {
  const { t } = useTranslation();
  const colorClass = STATUS_COLORS[status] || STATUS_COLORS.STABLE;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${colorClass}`}
      role="status"
      aria-label={t('patients.listStatusAria', { status: enumLabel(t, 'patientStatus', status) })}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current" aria-hidden="true" />
      {enumLabel(t, 'patientStatus', status)}
    </span>
  );
});
StatusBadge.displayName = 'StatusBadge';

interface Props {
  patients: PatientRow[];
  loading: boolean;
  error: string | null | undefined;
  search: string;
}

export const PatientsTableBody = ({ patients, loading, error, search }: Props) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <tbody className="divide-y divide-slate-100">
      {loading && patients.length === 0 ? (
        Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={`skeleton-${i}`} />)
      ) : error ? (
        <tr>
          <td colSpan={6} className="px-6 py-4">
            <div className="bg-red-50 text-red-600 px-4 py-3 rounded-xl" role="alert">
              {error}
            </div>
          </td>
        </tr>
      ) : patients.length === 0 ? (
        <tr>
          <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
            <Search className="w-12 h-12 mx-auto mb-3 opacity-30" aria-hidden="true" />
            <p>{t('patients.empty')}</p>
            {search && <p className="text-sm mt-1">{t('patients.emptyHint')}</p>}
          </td>
        </tr>
      ) : (
        patients.map((patient: PatientRow) => (
          <tr
            key={patient.id}
            className="hover:bg-slate-50 transition cursor-pointer focus-within:bg-slate-50"
            onClick={() => navigate(`/patients/${patient.id}`)}
            tabIndex={0}
            role="link"
            aria-label={t('patients.viewDetails', { name: patient.name })}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                navigate(`/patients/${patient.id}`);
              }
            }}
          >
            <td className="px-6 py-4 font-mono text-sm text-slate-500">
              {patient.patientCode}
            </td>
            <td className="px-6 py-4 font-medium text-clinic-text">
              {patient.name}
            </td>
            <td className="px-6 py-4 text-clinic-text/70">{patient.age}</td>
            <td className="px-6 py-4 text-clinic-text/70">{t(`departments.${patient.department}`, { defaultValue: patient.department })}</td>
            <td className="px-6 py-4 text-slate-500 text-sm">
              <time dateTime={patient.admissionDate}>
                {formatDate(patient.admissionDate, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </time>
            </td>
            <td className="px-6 py-4">
              <StatusBadge status={patient.status} />
            </td>
          </tr>
        ))
      )}
    </tbody>
  );
};
