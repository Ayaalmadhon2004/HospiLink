// frontend/src/components/Appointments/NewAppointmentModal.tsx
import { useState, useEffect } from 'react';
import { useTranslation, Trans } from 'react-i18next';
import { Link } from 'react-router-dom';
import { X, UserPlus, Clock, Stethoscope, MapPin, FileText } from 'lucide-react';
import { createAppointment, updateAppointment} from '../../services/appointmentsService';
import { apiGet } from '../../services/api';
import { Combobox } from '../Form/Combobox';
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

const SLOT_LENGTH = 16; // "YYYY-MM-DDTHH:mm", the value format of <input type="datetime-local">
const DEFAULT_LEAD_MINUTES = 30;

/** A new appointment starts half an hour from now unless the user picks another time. */
const defaultSlot = (): string => new Date(Date.now() + DEFAULT_LEAD_MINUTES * 60_000).toISOString().slice(0, SLOT_LENGTH);

const AppointmentForm = ({ onClose, onSuccess, editingAppointment }: Omit<NewAppointmentModalProps, 'isOpen'>) => {
  const { t } = useTranslation();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchingPatients, setFetchingPatients] = useState(false);

  // Form state
  // Starts from the appointment being edited (the form is mounted per opening, so there is nothing to reset)
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(editingAppointment?.patient ?? null);
  const [patientSearch, setPatientSearch] = useState(editingAppointment?.patient?.name ?? '');

  const [doctorId, setDoctorId] = useState(editingAppointment?.doctorId ?? '');
  const [scheduledAt, setScheduledAt] = useState(() =>
    editingAppointment?.scheduledAt ? new Date(editingAppointment.scheduledAt).toISOString().slice(0, SLOT_LENGTH) : defaultSlot(),
  );
  const [type, setType] = useState(editingAppointment?.type || 'CONSULTATION');
  const [department, setDepartment] = useState(editingAppointment?.department || 'General');
  const [room, setRoom] = useState(editingAppointment?.room ?? '');
  const [notes, setNotes] = useState(editingAppointment?.notes ?? '');
  const [duration, setDuration] = useState(editingAppointment?.duration || 30);
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
    fetchDoctors();
  }, []);

  // ─── Handle Patient Selection ──────────────────────
  const handleSelectPatient = (patient: Patient) => {
    setSelectedPatient(patient);
    setPatientSearch(patient.name);
    setPatients([]);
  };

  // ─── Handle New Patient Input ──────────────────────
  const handlePatientInputChange = (value: string) => {
    setPatientSearch(value);
    if (selectedPatient && selectedPatient.name !== value) {
      setSelectedPatient(null);
    }
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
      if (!selectedPatient?.id) {
        toast.error(t('appointments.modal.selectPatientError'));
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

      // Appointments only attach to an existing patient (admit new patients from the Patients page).
      data.patientId = selectedPatient.id;


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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-hospital-navy/50 backdrop-blur-sm">
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
            <Combobox
              options={patients.map((p) => ({ label: p.name, value: p.id, hint: p.patientCode }))}
              value={selectedPatient?.id ?? ''}
              onChange={(id) => {
                const patient = patients.find((p) => p.id === id);
                if (patient) handleSelectPatient(patient);
              }}
              query={patientSearch}
              onQueryChange={handlePatientInputChange}
              loading={fetchingPatients}
              emptyMessage={
                patientSearch.length >= 2 && !selectedPatient ? t('appointments.modal.noPatientFound') : undefined
              }
              placeholder={t('appointments.modal.patientPlaceholder')}
            />

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

            {/* Unknown patient: point at the real admit flow instead of inventing a record */}
            {!selectedPatient && patientSearch.length >= 2 && patients.length === 0 && !fetchingPatients && (
              <p className="mt-1 text-xs text-amber-700">
                <UserPlus size={12} className="inline me-1" aria-hidden="true" />
                {t('appointments.modal.noPatientFound')}{' '}
                <Link to="/patients" className="underline font-medium">{t('appointments.modal.admitPatientLink')}</Link>
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

/** Mounts the form only while open (one instance per appointment), so every opening starts from fresh state. */
export const NewAppointmentModal = ({ isOpen, ...formProps }: NewAppointmentModalProps) =>
  isOpen ? <AppointmentForm key={formProps.editingAppointment?.id ?? 'new'} {...formProps} /> : null;
