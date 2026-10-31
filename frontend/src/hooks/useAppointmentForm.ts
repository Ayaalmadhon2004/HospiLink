import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { createAppointment, updateAppointment } from '../services/appointmentsService';
import type { Appointment } from '../services/appointmentsService';
import { apiGet } from '../services/api';
import { extractList, getResponseData } from '../types/api';

export interface AppointmentPatient {
  id: string;
  name: string;
  patientCode: string;
  phone?: string;
  gender?: string;
  age?: number;
}

export interface AppointmentDoctor {
  id: string;
  name: string;
  role: string;
  department?: string;
}

export interface AppointmentFormOptions {
  onClose: () => void;
  onSuccess: () => void;
  editingAppointment?: (Appointment & { doctorId?: string }) | null;
}

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

const SLOT_LENGTH = 16; // "YYYY-MM-DDTHH:mm", the value format of <input type="datetime-local">
const DEFAULT_LEAD_MINUTES = 30;

/** A new appointment starts half an hour from now unless the user picks another time. */
const defaultSlot = (): string => new Date(Date.now() + DEFAULT_LEAD_MINUTES * 60_000).toISOString().slice(0, SLOT_LENGTH);

/** State, lookups and submit handler of the new/edit appointment form. */
export const useAppointmentForm = ({ onClose, onSuccess, editingAppointment }: AppointmentFormOptions) => {
  const { t } = useTranslation();
  const [patients, setPatients] = useState<AppointmentPatient[]>([]);
  const [doctors, setDoctors] = useState<AppointmentDoctor[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchingPatients, setFetchingPatients] = useState(false);

  // Form state
  // Starts from the appointment being edited (the form is mounted per opening, so there is nothing to reset)
  const [selectedPatient, setSelectedPatient] = useState<AppointmentPatient | null>(editingAppointment?.patient ?? null);
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

  // ─── Fetch Patients for Search ─────────────────────
  const fetchPatients = async (search: string) => {
    if (!search || search.length < 2) {
      setPatients([]);
      return;
    }
    setFetchingPatients(true);
    try {
      const res = await apiGet('/patients', { search, limit: '10' });
      setPatients(extractList<AppointmentPatient>(res));
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
        setDoctors(extractList<AppointmentDoctor>(res));
      } catch {
        // Doctor list stays empty on failure
      }
    };
    fetchDoctors();
  }, []);

  // ─── Handle Patient Selection ──────────────────────
  const handleSelectPatient = (patient: AppointmentPatient) => {
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

  const clearPatient = () => {
    setSelectedPatient(null);
    setPatientSearch('');
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

  return {
    patients, doctors, loading, fetchingPatients, selectedPatient, patientSearch,
    doctorId, setDoctorId, scheduledAt, setScheduledAt, type, setType,
    department, setDepartment, room, setRoom, notes, setNotes, duration, setDuration,
    isEditing, handleSelectPatient, handlePatientInputChange, clearPatient, handleSubmit,
  };
};
