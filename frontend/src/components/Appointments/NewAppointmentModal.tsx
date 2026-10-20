// frontend/src/components/Appointments/NewAppointmentModal.tsx
import { useState, useEffect } from 'react';
import { useTranslation, Trans } from 'react-i18next';
import { X, Search, UserPlus, Clock, Stethoscope, MapPin, FileText } from 'lucide-react';
import { createAppointment, updateAppointment} from '../../services/appointmentsService';
import { apiGet } from '../../services/api';
import { extractList, getResponseData } from '../../types/api';
import type { Appointment } from '../../services/appointmentsService';
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
  editingAppointment?: (Appointment & { doctorId?: string }) | null;
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
  const { t } = useTranslation();
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

  interface CreateAppointmentData {
  doctorId: string;
  scheduledAt: string;
  type: string;
  department: string;
  room?: string;
  notes?: string;
  duration?: number;
  patientId?: string;
  patientName?: string;
  patientCode?: string;
}

  // ─── Fetch Patients for Search ─────────────────────
  const fetchPatients = async (search: string) => {
    if (!search || search.length < 2) {
      setPatients([]);
      return;
    }
    setFetchingPatients(true);
    try {
      const res = await apiGet('/patients', { search, limit: '10' });
      setPatients(extractList<Patient>(res));
    } catch {
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
        setDoctors(extractList<Doctor>(res));
      } catch {
        // Doctor list stays empty on failure
      }
    };
    if (isOpen) fetchDoctors();
  }, [isOpen]);

  // ─── Reset / Load Editing Data ─────────────────────
  useEffect(() => {
    if (!isOpen) {
      // Reset form
      // eslint-disable-next-line react-hooks/set-state-in-effect -- effect intentionally syncs/fetches into state (data load or reset on prop change); restructuring would change behaviour
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
        toast.error(t('appointments.modal.selectDoctorError'));
        setLoading(false);
        return;
      }
      if (!scheduledAt) {
        toast.error(t('appointments.modal.selectDateError'));
        setLoading(false);
        return;
      }
      if (!patientSearch.trim()) {
        toast.error(t('appointments.modal.patientNameError'));
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
      } else {
        // New patient
        data.patientName = patientSearch.trim();
        data.patientCode = `PT-${Date.now()}`;
      }


      if (isEditing) {
        await updateAppointment(editingAppointment.id, data);
        toast.success(t('appointments.modal.updated'));
      } else {
        await createAppointment(data);
        toast.success(t('appointments.modal.created'));
      }

      onSuccess();
      onClose();
    } catch (err: unknown) {
      toast.error(getResponseData(err)?.message || t('appointments.modal.saveFailed'));
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
            {isEditing ? t('appointments.modal.editTitle') : t('appointments.new')}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition"
            aria-label={t('common.close')}
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* ─── Patient Search ────────────────────────── */}
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('appointments.modal.patient')} *
            </label>
            <div className="relative">
              <Search size={16} className="absolute start-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={patientSearch}
                onChange={(e) => handlePatientInputChange(e.target.value)}
                onFocus={() => setShowPatientDropdown(true)}
                placeholder={t('appointments.modal.patientPlaceholder')}
                className="w-full ps-10 pe-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                required
              />
              {selectedPatient && (
                <span className="absolute end-3 top-1/2 -translate-y-1/2">
                  <span className="text-xs bg-teal-100 text-teal-700 px-2 py-1 rounded-full">
                    <bdi dir="ltr">#{selectedPatient.patientCode}</bdi>
                  </span>
                </span>
              )}
            </div>

            {/* Patient Dropdown */}
            {showPatientDropdown && (patients.length > 0 || fetchingPatients) && !selectedPatient && (
              <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {fetchingPatients ? (
                  <div className="p-3 text-sm text-gray-500 text-center">{t('appointments.modal.searching')}</div>
                ) : patients.length === 0 ? (
                  <div className="p-3 text-sm text-gray-500 text-center">
                    <UserPlus size={14} className="inline me-1" />
                    {t('appointments.modal.willCreateColon', { name: patientSearch })}
                  </div>
                ) : (
                  patients.map((patient) => (
                    <button
                      key={patient.id}
                      type="button"
                      onClick={() => handleSelectPatient(patient)}
                      className="w-full text-start px-4 py-3 hover:bg-gray-50 border-b last:border-b-0 transition flex items-center justify-between"
                    >
                      <div>
                        <span className="font-medium text-gray-900">{patient.name}</span>
                        <span className="text-xs text-gray-500 ms-2"><bdi dir="ltr">#{patient.patientCode}</bdi></span>
                      </div>
                      {patient.phone && (
                        <bdi dir="ltr" className="text-xs text-gray-400">{patient.phone}</bdi>
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
                  <Trans i18nKey="appointments.modal.selected" values={{ name: selectedPatient.name }} components={{ strong: <strong /> }} />
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedPatient(null);
                    setPatientSearch('');
                  }}
                  className="text-xs text-red-500 hover:text-red-700"
                >
                  {t('appointments.modal.change')}
                </button>
              </div>
            )}

            {/* New Patient Hint */}
            {!selectedPatient && patientSearch.length >= 2 && patients.length === 0 && !fetchingPatients && (
              <p className="mt-1 text-xs text-amber-600">
                <UserPlus size={12} className="inline me-1" />
                {t('appointments.modal.willCreate', { name: patientSearch })}
              </p>
            )}
          </div>

          {/* ─── Doctor ────────────────────────────────── */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('appointments.modal.doctor')} *
            </label>
            <select
              value={doctorId}
              onChange={(e) => setDoctorId(e.target.value)}
              className="w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-teal-500 outline-none bg-white"
              required
            >
              <option value="">{t('appointments.modal.selectDoctor')}</option>
              {doctors.map((doc) => (
                <option key={doc.id} value={doc.id}>
                  {t('dashboard.doctorPrefix', { name: doc.name.replace(/^Dr\.\s*/i, '') })} — {doc.department || doc.role}
                </option>
              ))}
            </select>
          </div>

          {/* ─── Date & Time ───────────────────────────── */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Clock size={14} className="inline me-1" />
              {t('appointments.modal.dateTime')} *
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
              <Stethoscope size={14} className="inline me-1" />
              {t('appointments.modal.type')} *
            </label>
            <div className="grid grid-cols-2 gap-2">
              {APPOINTMENT_TYPES.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  aria-pressed={type === opt.value}
                  onClick={() => setType(opt.value)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition border ${
                    type === opt.value
                      ? opt.color + ' border-current ring-2 ring-offset-1 ring-current'
                      : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  {t(`appointments.types.${opt.value}`, { defaultValue: opt.label })}
                </button>
              ))}
            </div>
          </div>

          {/* ─── Department & Room ─────────────────────── */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('appointments.modal.department')}
              </label>
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-teal-500 outline-none bg-white"
              >
                {DEPARTMENTS.map((dept) => (
                  <option key={dept} value={dept}>{t(`departments.${dept}`, { defaultValue: dept })}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <MapPin size={14} className="inline me-1" />
                {t('appointments.modal.room')}
              </label>
              <input
                type="text"
                value={room}
                onChange={(e) => setRoom(e.target.value)}
                placeholder={t('appointments.modal.roomPlaceholder')}
                className="w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
              />
            </div>
          </div>

          {/* ─── Duration ──────────────────────────────── */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('appointments.modal.duration')}
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
              <span className="min-w-[60px] text-end font-medium text-gray-900">
                {t('appointments.minutes', { count: duration })}
              </span>
            </div>
          </div>

          {/* ─── Notes ─────────────────────────────────── */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <FileText size={14} className="inline me-1" />
              {t('appointments.modal.notes')}
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder={t('appointments.modal.notesPlaceholder')}
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
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2.5 bg-teal-700 text-white rounded-lg hover:bg-teal-800 transition disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {loading ? t('common.saving') : isEditing ? t('appointments.modal.update') : t('appointments.modal.create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};