import { ExportMenu } from '../components/Export/ExportMenu';
// pages/AppointmentsPage.tsx
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Calendar, Clock, Plus, Search } from 'lucide-react';
import { apiDelete } from '../services/api';
import type { Appointment } from '../services/appointmentsService';
import { SCHEDULE_KEY, useAppointmentsSchedule } from '../hooks/useAppointmentsSchedule';
import { NewAppointmentModal } from '../components/Appointments/NewAppointmentModal';
import { TodayAppointmentRow } from '../components/Appointments/TodayAppointmentRow';
import { UpcomingAppointmentRow } from '../components/Appointments/UpcomingAppointmentRow';
import { useOptimisticDelete, useCrudModal } from '../hooks/useCrud';
import { ConfirmDeleteDialog } from '../components/ConfirmDeleteDialog';
import { formatDate as fmtDate } from '../utils/datetime';
import { enumLabel } from '../utils/enumLabel';

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

  const { todayAppointments, upcoming, loading } = useAppointmentsSchedule();

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
              <TodayAppointmentRow key={apt.id} apt={apt} onEdit={handleEdit} onDelete={handleDeleteClick} />
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
                {enumLabel(t, 'appointmentType', type)}
              </option>
            ))}
          </select>
        </div>

        {/* List */}
        <div className="space-y-3">
          {filteredUpcoming.length > 0 ? (
            filteredUpcoming.map((apt) => (
              <UpcomingAppointmentRow key={apt.id} apt={apt} onEdit={handleEdit} onDelete={handleDeleteClick} />
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