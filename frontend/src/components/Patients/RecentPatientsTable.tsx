import { memo } from 'react';
import { useRecentPatients } from '../../hooks/useRecentPatients';
import { User, AlertCircle } from 'lucide-react';

interface Patient {
  id: string;
  name: string;
  status: 'OBSERVATION' | 'CRITICAL' | 'STABLE' | 'DISCHARGED';
  physicianName: string;
  bed: { wardName: string; bedNumber: string } | null;
}

const STATUS_CONFIG: Record<string, { bg: string; text: string; label: string; dot: string }> = {
  OBSERVATION: { 
    bg: 'bg-amber-100', 
    text: 'text-amber-700', 
    label: 'Under Observation',
    dot: 'bg-amber-500'
  },
  CRITICAL: { 
    bg: 'bg-red-100', 
    text: 'text-red-700', 
    label: 'Critical',
    dot: 'bg-red-500'
  },
  STABLE: { 
    bg: 'bg-teal-100', 
    text: 'text-teal-700', 
    label: 'Stable',
    dot: 'bg-teal-500'
  },
  DISCHARGED: { 
    bg: 'bg-gray-100', 
    text: 'text-gray-600', 
    label: 'Discharged',
    dot: 'bg-gray-400'
  },
};

const StatusBadge = memo(({ status }: { status: string }) => {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.STABLE;

  return (
    <span 
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}
      role="status"
      aria-label={`Patient status: ${config.label}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} aria-hidden="true" />
      {config.label}
    </span>
  );
});

StatusBadge.displayName = 'StatusBadge';

const SkeletonRow = memo(() => (
  <tr className="animate-pulse">
    <td className="py-4 px-4">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-slate-200" />
        <div className="h-4 w-24 bg-slate-200 rounded" />
      </div>
    </td>
    <td className="py-4 px-4"><div className="h-4 w-20 bg-slate-200 rounded" /></td>
    <td className="py-4 px-4"><div className="h-4 w-16 bg-slate-200 rounded" /></td>
    <td className="py-4 px-4"><div className="h-4 w-24 bg-slate-200 rounded" /></td>
    <td className="py-4 px-4"><div className="h-6 w-20 bg-slate-200 rounded-full" /></td>
  </tr>
));

SkeletonRow.displayName = 'SkeletonRow';

const RecentPatientsTable = memo(() => {
  const { patients, loading, error } = useRecentPatients();

  // ─── Loading State with Skeleton ────────────────────────────────
  if (loading) {
    return (
      <section className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm" aria-busy="true">
        <h3 className="text-lg font-bold text-slate-900 mb-6">Recently Admitted</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-xs uppercase text-slate-400 tracking-wider">
                <th scope="col" className="pb-4 font-semibold px-4">Patient</th>
                <th scope="col" className="pb-4 font-semibold px-4">Dept</th>
                <th scope="col" className="pb-4 font-semibold px-4">Room</th>
                <th scope="col" className="pb-4 font-semibold px-4">Physician</th>
                <th scope="col" className="pb-4 font-semibold px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {[1, 2, 3, 4, 5].map((i) => <SkeletonRow key={i} />)}
            </tbody>
          </table>
        </div>
      </section>
    );
  }

  // ─── Error State ────────────────────────────────────────────────
  if (error) {
    return (
      <section className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
        <h3 className="text-lg font-bold text-slate-900 mb-6">Recently Admitted</h3>
        <div 
          className="p-8 text-center"
          role="alert"
          aria-live="assertive"
        >
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" aria-hidden="true" />
          <p className="text-red-500 font-medium">Failed to load patients</p>
          <p className="text-red-400 text-sm mt-1">{String(error)}</p>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
      <h3 className="text-lg font-bold text-slate-900 mb-6">Recently Admitted</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="text-xs uppercase text-slate-400 tracking-wider">
              <th scope="col" className="pb-4 font-semibold px-4">Patient</th>
              <th scope="col" className="pb-4 font-semibold px-4">Dept</th>
              <th scope="col" className="pb-4 font-semibold px-4">Room</th>
              <th scope="col" className="pb-4 font-semibold px-4">Physician</th>
              <th scope="col" className="pb-4 font-semibold px-4">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {patients.length > 0 ? (
              patients.map((p: Patient) => (
                <tr 
                  key={p.id} 
                  className="text-sm hover:bg-slate-50 transition-colors"
                >
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-hospital-navy/10 flex items-center justify-center flex-shrink-0">
                        <User size={14} className="text-hospital-navy" aria-hidden="true" />
                      </div>
                      <span className="font-semibold text-slate-900">{p.name}</span>
                    </div>
                  </td>
                  <td className="py-4 px-4 text-slate-600">{p.bed?.wardName || 'N/A'}</td>
                  <td className="py-4 px-4 text-slate-600 font-mono text-xs">{p.bed?.bedNumber || '---'}</td>
                  <td className="py-4 px-4 text-slate-600">{p.physicianName}</td>
                  <td className="py-4 px-4"><StatusBadge status={p.status} /></td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="py-12 text-center text-slate-400">
                  <User className="w-12 h-12 mx-auto mb-3 opacity-30" aria-hidden="true" />
                  <p className="text-sm">No patients currently admitted</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
});

RecentPatientsTable.displayName = 'RecentPatientsTable';

export default RecentPatientsTable;