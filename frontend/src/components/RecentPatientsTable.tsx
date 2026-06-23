import { useRecentPatients } from '../hooks/useRecentPatients';

interface Patient {
  id: string;
  name: string;
  status: 'OBSERVATION' | 'CRITICAL' | 'STABLE';
  physicianName: string;
  bed: { wardName: string; bedNumber: string } | null;
}

const StatusBadge = ({ status }: { status: string }) => {
  const styles: Record<string, string> = {
    'OBSERVATION': 'bg-amber-100 text-amber-700',
    'CRITICAL': 'bg-red-100 text-red-700',
    'STABLE': 'bg-teal-100 text-teal-700'
  };
  return (
    <span className={`px-3 py-1 rounded-full text-xs font-medium ${styles[status] || 'bg-slate-100 text-slate-700'}`}>
      • {status}
    </span>
  );
};

const RecentPatientsTable = () => {
  const { patients, loading, error } = useRecentPatients();

  if (loading) return <div className="p-8 text-center text-slate-400">جاري التحميل...</div>;
  
  // تصحيح الخطأ: نستخدم error.message أو نعتبر الخطأ نصاً
  if (error) return <div className="p-8 text-center text-red-500 font-medium">حدث خطأ: {error?.toString()}</div>;

  return (
    <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
      <h3 className="text-lg font-bold text-slate-900 mb-6">Recently Admitted</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="text-xs uppercase text-slate-400 tracking-wider">
              <th className="pb-4 font-semibold">Patient</th>
              <th className="pb-4 font-semibold">Dept</th>
              <th className="pb-4 font-semibold">Room</th>
              <th className="pb-4 font-semibold">Physician</th>
              <th className="pb-4 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {patients.length > 0 ? (
              patients.map((p: Patient) => (
                <tr key={p.id} className="text-sm hover:bg-slate-50 transition-colors">
                  <td className="py-4 font-semibold text-slate-900">{p.name}</td>
                  <td className="py-4 text-slate-600">{p.bed?.wardName || 'N/A'}</td>
                  <td className="py-4 text-slate-600">{p.bed?.bedNumber || '---'}</td>
                  <td className="py-4 text-slate-600">{p.physicianName}</td>
                  <td className="py-4"><StatusBadge status={p.status} /></td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="py-8 text-center text-slate-400">لا يوجد مرضى حالياً</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default RecentPatientsTable;