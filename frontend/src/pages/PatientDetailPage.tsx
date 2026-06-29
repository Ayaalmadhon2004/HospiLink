import { useState , useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getPatientById, dischargePatient } from '../services/patientService';
import { ArrowLeft, User, Bed, Stethoscope, Activity, LogOut } from 'lucide-react';

const STATUS_COLORS = {
  STABLE: 'bg-green-100 text-green-700',
  OBSERVATION: 'bg-yellow-100 text-yellow-700',
  CRITICAL: 'bg-red-100 text-red-700',
  DISCHARGED: 'bg-gray-100 text-gray-500',
};

export const PatientDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [patient, setPatient] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showDischargeModal, setShowDischargeModal] = useState(false);
  const [discharging, setDischarging] = useState(false);

  useEffect(() => {
    const fetchPatient = async () => {
      if (!id) return;
      try {
        setLoading(true);
        const res = await getPatientById(id);
        setPatient(res.data);
      } catch (err: any) {
        setError(err.response?.data?.message || 'Failed to load patient');
      } finally {
        setLoading(false);
      }
    };
    fetchPatient();
  }, [id]);

  const handleDischarge = async () => {
    if (!id) return;
    setDischarging(true);
    try {
      await dischargePatient(id);
      setShowDischargeModal(false);
      // Refresh patient data
      const res = await getPatientById(id);
      setPatient(res.data);
      // Or navigate back
      // navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to discharge patient');
    } finally {
      setDischarging(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-slate-400">Loading...</div>
      </div>
    );
  }

  if (error || !patient) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="bg-red-50 text-red-600 px-6 py-4 rounded-xl">
          {error || 'Patient not found'}
          <button 
            onClick={() => navigate('/dashboard')}
            className="block mt-4 text-blue-600 hover:underline"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      {/* Back button */}
      <button 
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-slate-600 hover:text-slate-800 mb-6 transition"
      >
        <ArrowLeft size={20} />
        Back
      </button>

      <div className="max-w-4xl mx-auto">
        {/* Patient Header */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                <User size={32} className="text-blue-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-800">{patient.name}</h1>
                <p className="text-slate-500">{patient.patientCode}</p>
              </div>
            </div>
            <span className={`px-4 py-2 rounded-full text-sm font-medium ${STATUS_COLORS[patient.status as keyof typeof STATUS_COLORS]}`}>
              {patient.status}
            </span>
          </div>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Personal Info */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <User size={20} className="text-blue-600" />
              Personal Info
            </h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-slate-500">Age</span>
                <span className="font-medium">{patient.age} years</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Gender</span>
                <span className="font-medium">{patient.gender}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Admission Date</span>
                <span className="font-medium">
                  {new Date(patient.admissionDate).toLocaleDateString('en-US')}
                </span>
              </div>
              {patient.dischargeDate && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Discharge Date</span>
                  <span className="font-medium text-green-600">
                    {new Date(patient.dischargeDate).toLocaleDateString('en-US')}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Medical Info */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Stethoscope size={20} className="text-red-500" />
              Medical Info
            </h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-slate-500">Department</span>
                <span className="font-medium">{patient.department}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Diagnosis</span>
                <span className="font-medium">{patient.diagnosis}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Doctor</span>
                <span className="font-medium">{patient.doctor?.name || 'Not assigned'}</span>
              </div>
            </div>
          </div>

          {/* Bed Info */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Bed size={20} className="text-green-600" />
              Bed Info
            </h2>
            {patient.bed ? (
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-slate-500">Bed Number</span>
                  <span className="font-medium">{patient.bed.bedNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Ward</span>
                  <span className="font-medium">{patient.bed.wardName}</span>
                </div>
              </div>
            ) : (
              <p className="text-slate-400">No bed assigned</p>
            )}
          </div>

          {/* Vitals (Placeholder) */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Activity size={20} className="text-purple-600" />
              Vitals
            </h2>
            <p className="text-slate-400 text-sm">Coming soon - vitals tracking section</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button 
            onClick={() => navigate(`/patients/${id}/edit`)}
            className="bg-blue-600 text-white px-6 py-3 rounded-xl hover:bg-blue-700 transition"
          >
            Edit Patient
          </button>
          
          {/* Discharge Button - only show if not already discharged */}
          {patient.status !== 'DISCHARGED' && (
            <button 
              onClick={() => setShowDischargeModal(true)}
              className="bg-red-50 text-red-600 border border-red-200 px-6 py-3 rounded-xl hover:bg-red-100 transition flex items-center gap-2"
            >
              <LogOut size={18} />
              Discharge Patient
            </button>
          )}
        </div>
      </div>

      {/* Discharge Confirmation Modal */}
      {showDischargeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-2xl w-full max-w-md shadow-xl">
            <h2 className="text-xl font-bold text-slate-800 mb-2">Confirm Discharge</h2>
            <p className="text-slate-500 mb-6">
              Are you sure you want to discharge <strong>{patient.name}</strong>? 
              This will free the bed and mark the patient as discharged.
            </p>
            
            {error && (
              <div className="bg-red-50 text-red-600 px-4 py-3 rounded-xl mb-4 text-sm">
                {error}
              </div>
            )}

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDischargeModal(false)}
                className="bg-slate-100 text-slate-700 px-4 py-2 rounded-xl hover:bg-slate-200 transition"
                disabled={discharging}
              >
                Cancel
              </button>
              <button
                onClick={handleDischarge}
                className="bg-red-600 text-white px-4 py-2 rounded-xl hover:bg-red-700 transition disabled:opacity-50"
                disabled={discharging}
              >
                {discharging ? 'Discharging...' : 'Confirm Discharge'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};