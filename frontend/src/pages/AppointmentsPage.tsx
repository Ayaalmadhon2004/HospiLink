// pages/AppointmentsPage.tsx
import { useState, useEffect, useCallback, useRef } from 'react';
import { Calendar, Clock, Stethoscope, MapPin, Plus, Search, Trash2, Pencil } from 'lucide-react';
import { apiGet, apiDelete } from '../services/api';
import { useAppointmentsSocket } from '../hooks/useAppointmentsSocket';
import { NewAppointmentModal } from '../components/Appointments/NewAppointmentModal';
import { useOptimisticDelete, useCrudModal } from '../hooks/useCrud';
import { ConfirmDeleteDialog } from '../components/ConfirmDeleteDialog';
import { toast } from 'sonner';

interface Appointment {
  id: string;
  scheduledAt: string;
  type: string;
  status: string;
  department: string;
  room?: string;
  duration: number;
  patient: {
    id: string;
    name: string;
    patientCode: string;
  };
  doctor: {
    id: string;
    name: string;
    role: string;
  };
}

const typeColors: Record<string, string> = {
  SURGERY: 'bg-red-100 text-red-700 border-red-200',
  CONSULTATION: 'bg-teal-100 text-teal-700 border-teal-200',
  IMAGING: 'bg-blue-100 text-blue-700 border-blue-200',
  FOLLOW_UP: 'bg-amber-100 text-amber-700 border-amber-200',
  LAB_TEST: 'bg-purple-100 text-purple-700 border-purple-200',
};

const typeDotColors: Record<string, string> = {
  SURGERY: 'bg-red-500',
  CONSULTATION: 'bg-teal-500',
  IMAGING: 'bg-blue-500',
  FOLLOW_UP: 'bg-amber-500',
  LAB_TEST: 'bg-purple-500',
};

export const AppointmentsPage = () => {
  const [todayAppointments, setTodayAppointments] = useState<Appointment[]>([]);
  const [upcoming, setUpcoming] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('');

  // Shared CRUD hooks
  const { confirmDelete, handleDeleteClick, handleConfirmDelete, isDeleting } = useOptimisticDelete<Appointment>({
    queryKey: ['appointments'],
    deleteFn: (id: string) => apiDelete(`/appointments/${id}`),
    getItemId: (apt) => apt.id,
    itemName: 'Appointment',
  });

  const { isModalOpen, editingItem, handleAdd, handleEdit, handleModalSuccess } = useCrudModal<Appointment>();

  const isFetching = useRef(false);
  const lastSocketId = useRef<string | null>(null);

  const latestUpdate = useAppointmentsSocket();

  const fetchData = useCallback(async () => {
    if (isFetching.current) return;
    isFetching.current = true;
    setLoading(true);

    try {
      const [todayRes, upcomingRes] = await Promise.allSettled([
        apiGet('/appointments/today'),
        apiGet('/appointments/upcoming'),
      ]);

      // ✅ FIX: Handle today's appointments response structure
      if (todayRes.status === 'fulfilled') {
        const responseData = todayRes.value?.data;
        // The API returns { data: { appointments, schedule } }
        const todayList = responseData?.appointments || responseData || [];
        setTodayAppointments(Array.isArray(todayList) ? todayList : []);
        console.log('✅ Today appointments loaded:', todayList.length);
      } else {
        console.error('Failed to fetch today appointments:', todayRes.reason);
        setTodayAppointments([]);
      }

      // ✅ FIX: Handle upcoming appointments response structure
      if (upcomingRes.status === 'fulfilled') {
        const responseData = upcomingRes.value?.data;
        // The API returns { data: appointments[] }
        const upcomingList = responseData || [];
        setUpcoming(Array.isArray(upcomingList) ? upcomingList : []);
        console.log('✅ Upcoming appointments loaded:', upcomingList.length);
      } else {
        console.error('Failed to fetch upcoming appointments:', upcomingRes.reason);
        setUpcoming([]);
      }
    } catch (err) {
      console.error('Failed to fetch appointments:', err);
      toast.error('Failed to load appointments');
    } finally {
      setLoading(false);
      isFetching.current = false;
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!latestUpdate) return;
    const updateId = (latestUpdate as any)?.id || JSON.stringify(latestUpdate);
    if (updateId === lastSocketId.current) return;
    lastSocketId.current = updateId as string;
    fetchData();
  }, [latestUpdate, fetchData]);

  const formatTime = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
    } catch {
      return dateStr;
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return '';
    }
  };

  const filteredUpcoming = upcoming.filter((apt) => {
    const matchesSearch =
      apt.patient?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      apt.doctor?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      apt.patient?.patientCode?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      false;
    const matchesType = !selectedType || apt.type === selectedType;
    return matchesSearch && matchesType;
  });

  const appointmentTypes = [...new Set(upcoming.map((a) => a.type).filter(Boolean))];
  const hasData = todayAppointments.length > 0 || upcoming.length > 0;

  if (loading && !hasData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-pulse text-gray-400">Loading appointments...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <ConfirmDeleteDialog
        isOpen={!!confirmDelete}
        name={confirmDelete?.name || ''}
        itemType="appointment"
        onCancel={() => {}}
        onConfirm={handleConfirmDelete}
        isLoading={isDeleting}
      />

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Calendar size={28} className="text-teal-500" />
            Appointments
          </h1>
          <p className="text-gray-500 text-sm">Daily schedule and bookings</p>
        </div>
        <button
          onClick={handleAdd}
          className="flex items-center gap-2 bg-teal-500 text-white px-4 py-2 rounded-lg hover:bg-teal-600 transition"
        >
          <Plus size={16} />
          New Appointment
        </button>
      </div>

      {/* Modal */}
      <NewAppointmentModal
        isOpen={isModalOpen}
        onClose={handleModalSuccess}
        onSuccess={() => { fetchData(); handleModalSuccess(); }}
        editingAppointment={editingItem}
      />

      {/* Today's Schedule */}
      <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Today&apos;s Schedule</h2>
        <p className="text-gray-500 text-sm mb-4">
          {new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </p>

        <div className="space-y-3">
          {todayAppointments.length > 0 ? (
            todayAppointments.map((apt) => (
              <div
                key={apt.id}
                className={`flex items-start gap-4 p-4 rounded-lg border-l-4 ${
                  typeColors[apt.type] || 'bg-gray-50 border-gray-300'
                }`}
              >
                <div className="flex flex-col items-center min-w-[60px]">
                  <span className="text-lg font-bold text-gray-900">
                    {formatTime(apt.scheduledAt)}
                  </span>
                  <span className="text-xs text-gray-500">{apt.duration}min</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={`w-2 h-2 rounded-full ${typeDotColors[apt.type] || 'bg-gray-400'}`} />
                    <span className="font-medium text-gray-900">{apt.patient?.name || 'Unknown'}</span>
                    {apt.patient?.patientCode && (
                      <span className="text-xs text-gray-400">{apt.patient.patientCode}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-600 flex-wrap">
                    <span className="flex items-center gap-1">
                      <Stethoscope size={14} />
                      {apt.type}
                    </span>
                    {apt.doctor?.name && (
                      <span className="flex items-center gap-1">
                        {apt.doctor.name.replace(/^Dr\.\s*/i, '')}
                      </span>
                    )}
                    {apt.room && (
                      <span className="flex items-center gap-1">
                        <MapPin size={14} />
                        {apt.room}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-1 opacity-0 hover:opacity-100 transition">
                  <button
                    onClick={() => handleEdit(apt)}
                    className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                    title="Edit"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => handleDeleteClick(apt.id, `Appointment for ${apt.patient?.name || 'Unknown'}`)}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-gray-400">
              <Clock size={48} className="mx-auto mb-3 opacity-50" />
              <p>No appointments scheduled for today</p>
            </div>
          )}
        </div>
      </div>

      {/* Upcoming Appointments */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Upcoming</h2>
            <p className="text-gray-500 text-sm">Next appointments</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4 mb-4">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search patients, doctors..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
            />
          </div>
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 outline-none bg-white"
          >
            <option value="">All Types</option>
            {appointmentTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>

        {/* List */}
        <div className="space-y-3">
          {filteredUpcoming.length > 0 ? (
            filteredUpcoming.map((apt) => (
              <div
                key={apt.id}
                className="flex items-center gap-4 p-4 rounded-lg border hover:bg-gray-50 transition group"
              >
                <div className="flex flex-col items-center min-w-[60px] bg-gray-100 rounded-lg p-2">
                  <span className="text-xs text-gray-500">{formatDate(apt.scheduledAt)}</span>
                  <span className="text-sm font-bold text-gray-900">
                    {formatTime(apt.scheduledAt)}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`w-2 h-2 rounded-full ${typeDotColors[apt.type] || 'bg-gray-400'}`} />
                    <span className="font-medium text-gray-900">{apt.patient?.name || 'Unknown'}</span>
                    {apt.patient?.patientCode && (
                      <span className="text-xs text-gray-400">{apt.patient.patientCode}</span>
                    )}
                  </div>
                  <div className="text-sm text-gray-500 mt-1">
                    {apt.type} &middot; {apt.doctor?.name ? apt.doctor.name.replace(/^Dr\.\s*/i, '') : 'No doctor'} &middot; {apt.department}
                  </div>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${typeColors[apt.type] || ''}`}>
                  {apt.type}
                </span>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                  <button
                    onClick={() => handleEdit(apt)}
                    className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                    title="Edit"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => handleDeleteClick(apt.id, `Appointment for ${apt.patient?.name || 'Unknown'}`)}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-gray-400">
              <Calendar size={48} className="mx-auto mb-3 opacity-50" />
              <p>No upcoming appointments</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};