import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { usePatients } from '../hooks/usePatients';
import { AdmitPatientModal } from '../components/Dashboard/AdmitPatientModal';

const STATUS_COLORS = {
  STABLE: 'bg-green-100 text-green-700',
  OBSERVATION: 'bg-yellow-100 text-yellow-700',
  CRITICAL: 'bg-red-100 text-red-700',
  DISCHARGED: 'bg-gray-100 text-gray-500',
};

export const PatientsPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { patients, loading, error, refetch } = usePatients({
    status: statusFilter,
    search: search || undefined,
  });

  const handlePatientAdded = () => {
    // Invalidate and refetch patients list
    queryClient.invalidateQueries({ queryKey: ['patients'] });
    setIsModalOpen(false);
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-hospital-navy">Patients</h1>
          <p className="text-clinic-text/50">Admitted patient records</p>
        </div>
        
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-hospital-navy text-white px-4 py-2 rounded-lg hover:bg-hospital-navy/90 transition"
        >
          + Admit Patient
        </button>
      </div>

      <AdmitPatientModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onAdd={handlePatientAdded} 
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="flex gap-2">
          {['All', 'Stable', 'Observation', 'Critical', 'Discharged'].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition ${
                statusFilter === s
                  ? 'bg-hospital-navy text-white'
                  : 'bg-white text-clinic-text hover:bg-slate-100'
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        <input
          type="text"
          placeholder="Search by name or ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-slate-200 px-4 py-2 rounded-xl focus:ring-2 focus:ring-medical-teal outline-none ml-auto"
        />
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-12 text-clinic-text/40">Loading patients...</div>
      ) : error ? (
        <div className="bg-red-50 text-red-600 px-4 py-3 rounded-xl">{error}</div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 text-clinic-text/50 text-sm uppercase">
              <tr>
                <th className="px-6 py-4 text-left font-medium">Patient ID</th>
                <th className="px-6 py-4 text-left font-medium">Name</th>
                <th className="px-6 py-4 text-left font-medium">Age</th>
                <th className="px-6 py-4 text-left font-medium">Department</th>
                <th className="px-6 py-4 text-left font-medium">Admission Date</th>
                <th className="px-6 py-4 text-left font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {patients.map((patient: any) => (
                <tr
                  key={patient.id}
                  className="hover:bg-slate-50 transition cursor-pointer"
                  onClick={() => navigate(`/patients/${patient.id}`)}
                >
                  <td className="px-6 py-4 font-mono text-sm text-clinic-text/60">
                    {patient.patientCode}
                  </td>
                  <td className="px-6 py-4 font-medium text-clinic-text">
                    {patient.name}
                  </td>
                  <td className="px-6 py-4 text-clinic-text/70">{patient.age}</td>
                  <td className="px-6 py-4 text-clinic-text/70">{patient.department}</td>
                  <td className="px-6 py-4 text-clinic-text/50 text-sm">
                    {new Date(patient.admissionDate).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
                        STATUS_COLORS[patient.status as keyof typeof STATUS_COLORS]
                      }`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-current" />
                      {patient.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="px-6 py-4 border-t border-slate-100 text-sm text-clinic-text/50">
            Showing {patients.length} patients
          </div>
        </div>
      )}
    </div>
  );
};