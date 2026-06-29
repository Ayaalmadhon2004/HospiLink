import { useState, useEffect } from 'react';
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
      const res = await getPatientById(id);
      setPatient(res.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to discharge patient');
    } finally {
      setDischarging(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-clinic-bg">
        <div className="text-clinic-text/50">Loading...</div>
      </div>
    );
  }

  if (error || !patient) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-clinic-bg">
        <div className="bg-red-50 text-red-600 px-6 py-4 rounded-xl">
          {error || 'Patient not found'}
          <button 
            onClick={() => navigate('/dashboard')}
            className="block mt-4 text-hospital-navy hover:underline"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-clinic-bg p-8">
      {/* Back button */}
      <button 
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-clinic-text/70 hover:text-clinic-text mb-6 transition"
      >
        <ArrowLeft size={20} />
        Back
      </button>

      <div className="max-w-4xl mx-auto">
        {/* Patient Header */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-hospital-navy/10 rounded-full flex items-center justify-center">
                <User size={32} className="text-hospital-navy" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-hospital-navy">{patient.name}</h1>
                <p className="text-clinic-text/50">{patient.patientCode}</p>
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
            <h2 className="text-lg font-bold text-hospital-navy mb-4 flex items-center gap-2">
              <User size={20} className="text-medical-teal" />
              Personal Information
            </h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-clinic-text/50">Age</span>
                <span className="font-medium text-clinic-text">{patient.age} years</span>
              </div>
              <div className="flex justify-between">
                <span className="text-clinic-text/50">Gender</span>
                <span className="font-medium text-clinic-text">{patient.gender}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-clinic-text/50">Admission Date</span>
                <span className="font-medium text-clinic-text">
                  {new Date(patient.admissionDate).toLocaleDateString('en-US')}
                </span>
              </div>
              {patient.dischargeDate && (
                <div className="flex justify-between">
                  <span className="text-clinic-text/50">Discharge Date</span>
                  <span className="font-medium text-medical-teal">
                    {new Date(patient.dischargeDate).toLocaleDateString('en-US')}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Medical Info */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-bold text-hospital-navy mb-4 flex items-center gap-2">
              <Stethoscope size={20} className="text-red-500" />
              Medical Information
            </h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-clinic-text/50">Department</span>
                <span className="font-medium text-clinic-text">{patient.department}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-clinic-text/50">Diagnosis</span>
                <span className="font-medium text-clinic-text">{patient.diagnosis}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-clinic-text/50">Attending Physician</span>
                <span className="font-medium text-clinic-text">{patient.doctor?.name || 'Not assigned'}</span>
              </div>
            </div>
          </div>

          {/* Bed Info */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-bold text-hospital-navy mb-4 flex items-center gap-2">
              <Bed size={20} className="text-medical-teal" />
              Bed Information
            </h2>
            {patient.bed ? (
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-clinic-text/50">Bed Number</span>
                  <span className="font-medium text-clinic-text">{patient.bed.bedNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-clinic-text/50">Ward</span>
                  <span className="font-medium text-clinic-text">{patient.bed.wardName}</span>
                </div>
              </div>
            ) : (
              <p className="text-clinic-text/40">No bed assigned</p>
            )}
          </div>

          {/* Vitals */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-bold text-hospital-navy mb-4 flex items-center gap-2">
              <Activity size={20} className="text-purple-500" />
              Vitals
            </h2>
            <p className="text-clinic-text/40 text-sm">Coming soon - vitals tracking section</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button 
            onClick={() => navigate(`/patients/${id}/edit`)}
            className="bg-hospital-navy text-white px-6 py-3 rounded-xl hover:bg-hospital-navy/90 transition"
          >
            Edit Patient
          </button>
          
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-2xl w-full max-w-md shadow-xl">
            <h2 className="text-xl font-bold text-hospital-navy mb-2">Confirm Discharge</h2>
            <p className="text-clinic-text/50 mb-6">
              Are you sure you want to discharge <strong className="text-clinic-text">{patient.name}</strong>? 
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
                className="bg-slate-100 text-clinic-text px-4 py-2 rounded-xl hover:bg-slate-200 transition"
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