import { ExportMenu } from '../components/Export/ExportMenu';
// pages/AppointmentsPage.tsx
import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Calendar, Clock, Stethoscope, MapPin, Plus, Search, Trash2, Pencil } from 'lucide-react';
import { apiGet, apiDelete } from '../services/api';
import type { Appointment } from '../services/appointmentsService';
import type { ApiResponse } from '../types/api';
import { useAppointmentsSocket } from '../hooks/useAppointmentsSocket';
import { NewAppointmentModal } from '../components/Appointments/NewAppointmentModal';
import { useOptimisticDelete, useCrudModal } from '../hooks/useCrud';
import { ConfirmDeleteDialog } from '../components/ConfirmDeleteDialog';
import { toast } from 'sonner';
import { formatDate as fmtDate, formatTime as fmtTime } from '../utils/datetime';

const SCHEDULE_KEY = ['appointments', 'schedule'];

interface Schedule {
  today: Appointment[];
  upcoming: Appointment[];
}

// Today and upcoming load independently: one failing leaves the other list usable.
const fetchSchedule = async (): Promise<Schedule> => {
  const [todayRes, upcomingRes] = await Promise.allSettled([
    // The endpoint returns either a bare list or { appointments }
    apiGet<ApiResponse<Appointment[] & { appointments?: Appointment[] }>>('/appointments/today'),
    apiGet<ApiResponse<Appointment[]>>('/appointments/upcoming'),
  ]);
  if (todayRes.status === 'rejected' && upcomingRes.status === 'rejected') throw todayRes.reason;

  const todayData = todayRes.status === 'fulfilled' ? todayRes.value?.data : undefined;
  const todayList = todayData?.appointments || todayData || [];
  const upcomingList = upcomingRes.status === 'fulfilled' ? upcomingRes.value?.data : undefined;
  return {
    today: Array.isArray(todayList) ? todayList : [],
    upcoming: Array.isArray(upcomingList) ? upcomingList : [],
  };
};

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
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('');

  // Shared CRUD hooks
  const { confirmDelete, handleDeleteClick, handleConfirmDelete, isDeleting } = useOptimisticDelete<Appointment>({
    queryKey: ['appointments'],
    deleteFn: (id: string) => apiDelete(`/appointments/${id}`),
    getItemId: (apt) => apt.id,
    itemName: t('appointments.itemName'),
  });

  const { isModalOpen, editingItem, handleAdd, handleEdit, handleModalSuccess } = useCrudModal<Appointment>();

  const latestUpdate = useAppointmentsSocket();

  const { data, isPending: loading, isError } = useQuery({ queryKey: SCHEDULE_KEY, queryFn: fetchSchedule });
  const todayAppointments = data?.today ?? [];
  const upcoming = data?.upcoming ?? [];

  useEffect(() => {
    if (isError) toast.error(t('appointments.loadError'));
  }, [isError, t]);

  // A socket update (booked / moved / cancelled elsewhere) refetches both lists.
  useEffect(() => {
    if (latestUpdate) void queryClient.invalidateQueries({ queryKey: SCHEDULE_KEY });
  }, [latestUpdate, queryClient]);

  const formatTime = (dateStr: string) => {
    return fmtTime(dateStr, { hour: '2-digit', minute: '2-digit', hour12: false }, dateStr);
  };

  const formatDate = (dateStr: string) => {
    return fmtDate(dateStr, { month: 'short', day: 'numeric' });
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
        <div className="animate-pulse text-gray-400">{t('appointments.loading')}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <ConfirmDeleteDialog
        isOpen={!!confirmDelete}
        name={confirmDelete?.name || ''}
        itemType={t('appointments.itemType')}
        onCancel={() => {}}
        onConfirm={handleConfirmDelete}
        isLoading={isDeleting}
      />

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Calendar size={28} className="text-teal-500" />
            {t('appointments.title')}
          </h1>
          <p className="text-gray-500 text-sm">{t('appointments.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportMenu type="appointments" />
          <button
            onClick={handleAdd}
            className="flex items-center gap-2 bg-teal-500 text-white px-4 py-2 rounded-lg hover:bg-teal-600 transition"
          >
            <Plus size={16} />
            {t('appointments.new')}
          </button>
        </div>
      </div>

      {/* Modal */}
      <NewAppointmentModal
        isOpen={isModalOpen}
        onClose={handleModalSuccess}
        onSuccess={() => { void queryClient.invalidateQueries({ queryKey: SCHEDULE_KEY }); handleModalSuccess(); }}
        editingAppointment={editingItem}
      />

      {/* Today's Schedule */}
      <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">{t('appointments.todaySchedule')}</h2>
        <p className="text-gray-500 text-sm mb-4">
          {fmtDate(new Date(), {
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
                className={`group flex items-start gap-3 sm:gap-4 p-3 sm:p-4 rounded-lg border-s-4 ${
                  typeColors[apt.type] || 'bg-gray-50 border-gray-300'
                }`}
              >
                <div className="flex flex-col items-center min-w-[60px]">
                  <span className="text-lg font-bold text-gray-900">
                    {formatTime(apt.scheduledAt)}
                  </span>
                  <span className="text-xs text-gray-500">{t('appointments.minutes', { count: apt.duration })}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={`w-2 h-2 rounded-full ${typeDotColors[apt.type] || 'bg-gray-400'}`} />
                    <span className="font-medium text-gray-900">{apt.patient?.name || t('common.unknown')}</span>
                    {apt.patient?.patientCode && (
                      <span className="text-xs text-gray-400">{apt.patient.patientCode}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-600 flex-wrap">
                    <span className="flex items-center gap-1">
                      <Stethoscope size={14} />
                      {t(`appointments.types.${apt.type}`, { defaultValue: apt.type })}
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
                <div className="flex gap-1 md:opacity-0 md:group-hover:opacity-100 focus-within:opacity-100 transition">
                  <button
                    onClick={() => handleEdit(apt)}
                    className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                    title={t('common.edit')}
                    aria-label={t('common.edit')}
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => handleDeleteClick(apt.id, t('appointments.appointmentFor', { name: apt.patient?.name || t('common.unknown') }))}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                    title={t('common.delete')}
                    aria-label={t('common.delete')}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-gray-400">
              <Clock size={48} className="mx-auto mb-3 opacity-50" />
              <p>{t('appointments.emptyToday')}</p>
            </div>
          )}
        </div>
      </div>

      {/* Upcoming Appointments */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{t('appointments.upcoming')}</h2>
            <p className="text-gray-500 text-sm">{t('appointments.upcomingHint')}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4 mb-4">
          <div className="relative flex-1">
            <Search size={16} className="absolute start-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder={t('appointments.searchPlaceholder')}
              aria-label={t('appointments.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full ps-10 pe-4 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
            />
          </div>
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            aria-label={t('appointments.filterType')}
            className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 outline-none bg-white"
          >
            <option value="">{t('appointments.allTypes')}</option>
            {appointmentTypes.map((type) => (
              <option key={type} value={type}>
                {t(`appointments.types.${type}`, { defaultValue: type })}
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
                className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-lg border hover:bg-gray-50 transition group"
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
                    <span className="font-medium text-gray-900">{apt.patient?.name || t('common.unknown')}</span>
                    {apt.patient?.patientCode && (
                      <span className="text-xs text-gray-400">{apt.patient.patientCode}</span>
                    )}
                  </div>
                  <div className="text-sm text-gray-500 mt-1">
                    {t(`appointments.types.${apt.type}`, { defaultValue: apt.type })} &middot; {apt.doctor?.name ? apt.doctor.name.replace(/^Dr\.\s*/i, '') : t('appointments.noDoctor')} &middot; {t(`departments.${apt.department}`, { defaultValue: apt.department })}
                  </div>
                </div>
                <span className={`hidden sm:inline-block px-2 py-1 rounded-full text-xs font-medium ${typeColors[apt.type] || ''}`}>
                  {t(`appointments.types.${apt.type}`, { defaultValue: apt.type })}
                </span>
                <div className="flex gap-1 md:opacity-0 md:group-hover:opacity-100 focus-within:opacity-100 transition">
                  <button
                    onClick={() => handleEdit(apt)}
                    className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                    title={t('common.edit')}
                    aria-label={t('common.edit')}
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => handleDeleteClick(apt.id, t('appointments.appointmentFor', { name: apt.patient?.name || t('common.unknown') }))}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                    title={t('common.delete')}
                    aria-label={t('common.delete')}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-gray-400">
              <Calendar size={48} className="mx-auto mb-3 opacity-50" />
              <p>{t('appointments.emptyUpcoming')}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};