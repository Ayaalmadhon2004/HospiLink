// frontend/src/components/Appointments/NewAppointmentModal.tsx
import { useState, useEffect } from 'react';
import { X, Search, UserPlus, Clock, Stethoscope, MapPin, FileText } from 'lucide-react';
import { createAppointment, updateAppointment} from '../../services/appointmentsService';
import { apiGet } from '../../services/api';
import { toast } from 'sonner';

interface Patient {
  id: string;
  name: string;
  patientCode: string;
  phone?: string;
  gender?: string;
  age?: number;
}

interface Doctor {
  id: string;
  name: string;
  role: string;
  department?: string;
}

interface NewAppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editingAppointment?: any;
}

const APPOINTMENT_TYPES = [
  { value: 'CONSULTATION', label: 'Consultation', color: 'bg-teal-100 text-teal-700' },
  { value: 'SURGERY', label: 'Surgery', color: 'bg-red-100 text-red-700' },
  { value: 'IMAGING', label: 'Imaging', color: 'bg-blue-100 text-blue-700' },
  { value: 'FOLLOW_UP', label: 'Follow-up', color: 'bg-amber-100 text-amber-700' },
  { value: 'LAB_TEST', label: 'Lab Test', color: 'bg-purple-100 text-purple-700' },
];

const DEPARTMENTS = [
  'General',
  'Cardiology',
  'Neurology',
  'Orthopedics',
  'Pediatrics',
  'Emergency',
  'Radiology',
  'Surgery',
];

export const NewAppointmentModal = ({ isOpen, onClose, onSuccess, editingAppointment }: NewAppointmentModalProps) => {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchingPatients, setFetchingPatients] = useState(false);

  // Form state
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [patientSearch, setPatientSearch] = useState('');
  const [showPatientDropdown, setShowPatientDropdown] = useState(false);
  
  const [doctorId, setDoctorId] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [type, setType] = useState('CONSULTATION');
  const [department, setDepartment] = useState('General');
  const [room, setRoom] = useState('');
  const [notes, setNotes] = useState('');
  const [duration, setDuration] = useState(30);

  const isEditing = !!editingAppointment;

  // ─── Fetch Patients for Search ─────────────────────
  const fetchPatients = async (search: string) => {
    if (!search || search.length < 2) {
      setPatients([]);
      return;
    }
    setFetchingPatients(true);
    try {
      const res = await apiGet('/patients', { search, limit: '10' });
      const data = res?.data?.data || res?.data || [];
      setPatients(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to fetch patients:', err);
      setPatients([]);
    } finally {
      setFetchingPatients(false);
    }
  };

  // Debounce patient search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (patientSearch && !selectedPatient) {
        fetchPatients(patientSearch);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [patientSearch, selectedPatient]);

  // ─── Fetch Doctors ─────────────────────────────────
  useEffect(() => {
    const fetchDoctors = async () => {
      try {
        const res = await apiGet('/staff', { role: 'DOCTOR', limit: '50' });
        const data = res?.data?.data || res?.data || [];
        setDoctors(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Failed to fetch doctors:', err);
      }
    };
    if (isOpen) fetchDoctors();
  }, [isOpen]);

  // ─── Reset / Load Editing Data ─────────────────────
  useEffect(() => {
    if (!isOpen) {
      // Reset form
      setSelectedPatient(null);
      setPatientSearch('');
      setDoctorId('');
      setScheduledAt('');
      setType('CONSULTATION');
      setDepartment('General');
      setRoom('');
      setNotes('');
      setDuration(30);
      setPatients([]);
      return;
    }

    if (editingAppointment) {
      // Load editing data
      setSelectedPatient(editingAppointment.patient || null);
      setPatientSearch(editingAppointment.patient?.name || '');
      setDoctorId(editingAppointment.doctorId || '');
      setScheduledAt(
        editingAppointment.scheduledAt 
          ? new Date(editingAppointment.scheduledAt).toISOString().slice(0, 16) 
          : ''
      );
      setType(editingAppointment.type || 'CONSULTATION');
      setDepartment(editingAppointment.department || 'General');
      setRoom(editingAppointment.room || '');
      setNotes(editingAppointment.notes || '');
      setDuration(editingAppointment.duration || 30);
    } else {
      // Default for new appointment
      const now = new Date();
      now.setMinutes(now.getMinutes() + 30);
      setScheduledAt(now.toISOString().slice(0, 16));
    }
  }, [isOpen, editingAppointment]);

  // ─── Handle Patient Selection ──────────────────────
  const handleSelectPatient = (patient: Patient) => {
    setSelectedPatient(patient);
    setPatientSearch(patient.name);
    setShowPatientDropdown(false);
    setPatients([]);
  };

  // ─── Handle New Patient Input ──────────────────────
  const handlePatientInputChange = (value: string) => {
    setPatientSearch(value);
    if (selectedPatient && selectedPatient.name !== value) {
      setSelectedPatient(null);
    }
    setShowPatientDropdown(true);
  };

  // ─── Submit ────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!doctorId) {
        toast.error('Please select a doctor');
        setLoading(false);
        return;
      }
      if (!scheduledAt) {
        toast.error('Please select a date and time');
        setLoading(false);
        return;
      }
      if (!patientSearch.trim()) {
        toast.error('Please enter a patient name');
        setLoading(false);
        return;
      }

      const data: CreateAppointmentData = {
        doctorId,
        scheduledAt: new Date(scheduledAt).toISOString(),
        type,
        department,
        room: room || undefined,
        notes: notes || undefined,
        duration: Number(duration) || 30,
      };

      // ✅ KEY FIX: Send patientId if selected from dropdown
      if (selectedPatient?.id) {
        data.patientId = selectedPatient.id;
        data.patientName = selectedPatient.name;
        data.patientCode = selectedPatient.patientCode;
        console.log('✅ Using existing patient:', selectedPatient.name, selectedPatient.id);
      } else {
        // New patient
        data.patientName = patientSearch.trim();
        data.patientCode = `PT-${Date.now()}`;
        console.log('🆕 Creating new patient:', data.patientName);
      }

      console.log('🚀 Sending:', data);

      if (isEditing) {
        await updateAppointment(editingAppointment.id, data);
        toast.success('Appointment updated successfully');
      } else {
        await createAppointment(data);
        toast.success('Appointment created successfully');
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Submit error:', err);
      toast.error(err?.response?.data?.message || 'Failed to save appointment');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto m-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-bold text-gray-900">
            {isEditing ? 'Edit Appointment' : 'New Appointment'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* ─── Patient Search ────────────────────────── */}
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Patient *
            </label>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={patientSearch}
                onChange={(e) => handlePatientInputChange(e.target.value)}
                onFocus={() => setShowPatientDropdown(true)}
                placeholder="Search existing patient or type new name..."
                className="w-full pl-10 pr-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                required
              />
              {selectedPatient && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2">
                  <span className="text-xs bg-teal-100 text-teal-700 px-2 py-1 rounded-full">
                    #{selectedPatient.patientCode}
                  </span>
                </span>
              )}
            </div>

            {/* Patient Dropdown */}
            {showPatientDropdown && (patients.length > 0 || fetchingPatients) && !selectedPatient && (
              <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {fetchingPatients ? (
                  <div className="p-3 text-sm text-gray-500 text-center">Searching...</div>
                ) : patients.length === 0 ? (
                  <div className="p-3 text-sm text-gray-500 text-center">
                    <UserPlus size={14} className="inline mr-1" />
                    Will create new patient: "{patientSearch}"
                  </div>
                ) : (
                  patients.map((patient) => (
                    <button
                      key={patient.id}
                      type="button"
                      onClick={() => handleSelectPatient(patient)}
                      className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b last:border-b-0 transition flex items-center justify-between"
                    >
                      <div>
                        <span className="font-medium text-gray-900">{patient.name}</span>
                        <span className="text-xs text-gray-500 ml-2">#{patient.patientCode}</span>
                      </div>
                      {patient.phone && (
                        <span className="text-xs text-gray-400">{patient.phone}</span>
                      )}
                    </button>
                  ))
                )}
              </div>
            )}

            {/* Selected Patient Badge */}
            {selectedPatient && (
              <div className="mt-2 flex items-center gap-2">
                <span className="text-sm text-gray-600">
                  Selected: <strong>{selectedPatient.name}</strong>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedPatient(null);
                    setPatientSearch('');
                  }}
                  className="text-xs text-red-500 hover:text-red-700"
                >
                  Change
                </button>
              </div>
            )}

            {/* New Patient Hint */}
            {!selectedPatient && patientSearch.length >= 2 && patients.length === 0 && !fetchingPatients && (
              <p className="mt-1 text-xs text-amber-600">
                <UserPlus size={12} className="inline mr-1" />
                Will create new patient "{patientSearch}"
              </p>
            )}
          </div>

          {/* ─── Doctor ────────────────────────────────── */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Doctor *
            </label>
            <select
              value={doctorId}
              onChange={(e) => setDoctorId(e.target.value)}
              className="w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-teal-500 outline-none bg-white"
              required
            >
              <option value="">Select doctor...</option>
              {doctors.map((doc) => (
                <option key={doc.id} value={doc.id}>
                  {doc.name.replace(/^Dr\.\s*/i, 'Dr. ')} — {doc.department || doc.role}
                </option>
              ))}
            </select>
          </div>

          {/* ─── Date & Time ───────────────────────────── */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Clock size={14} className="inline mr-1" />
              Date & Time *
            </label>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
              required
            />
          </div>

          {/* ─── Type ──────────────────────────────────── */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Stethoscope size={14} className="inline mr-1" />
              Type *
            </label>
            <div className="grid grid-cols-2 gap-2">
              {APPOINTMENT_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setType(t.value)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition border ${
                    type === t.value
                      ? t.color + ' border-current ring-2 ring-offset-1 ring-current'
                      : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* ─── Department & Room ─────────────────────── */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Department
              </label>
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-teal-500 outline-none bg-white"
              >
                {DEPARTMENTS.map((dept) => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <MapPin size={14} className="inline mr-1" />
                Room
              </label>
              <input
                type="text"
                value={room}
                onChange={(e) => setRoom(e.target.value)}
                placeholder="e.g. Room 101"
                className="w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
              />
            </div>
          </div>

          {/* ─── Duration ──────────────────────────────── */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Duration (minutes)
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="15"
                max="120"
                step="15"
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="flex-1"
              />
              <span className="min-w-[60px] text-right font-medium text-gray-900">
                {duration} min
              </span>
            </div>
          </div>

          {/* ─── Notes ─────────────────────────────────── */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <FileText size={14} className="inline mr-1" />
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Additional notes..."
              className="w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-teal-500 outline-none resize-none"
            />
          </div>

          {/* ─── Actions ───────────────────────────────── */}
          <div className="flex gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border rounded-lg hover:bg-gray-50 transition text-gray-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2.5 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {loading ? 'Saving...' : isEditing ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};