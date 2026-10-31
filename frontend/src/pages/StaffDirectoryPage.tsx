// pages/StaffDirectoryPage.tsx
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Users, RefreshCw, Search, Plus
} from 'lucide-react';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { getStaff, deleteStaff, getShiftTimeline } from '../services/staffService';
import { extractList } from '../types/api';
import type { Shift } from '../types/staff';
import { useStaffSocket } from '../hooks/useStaffSocket';
import { useAuthPermissions } from '../hooks/useAuthPermissions';
import { StaffModal } from '../components/Staff/StaffModal';
import { useOptimisticDelete, useCrudModal } from '../hooks/useCrud';
import { ConfirmDeleteDialog } from '../components/ConfirmDeleteDialog';
import { StaffCard } from '../components/Staff/StaffCard';
import { ShiftTimeline } from '../components/Staff/ShiftTimeline';
import { StaffTable } from '../components/Staff/StaffTable';
import type { StaffMember } from '../components/Staff/staffMember';

export const StaffDirectoryPage = () => {
  const { t } = useTranslation();
  const canManage = useAuthPermissions().can('staff:manage');
  const [selectedDept, setSelectedDept] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');

  // ✅ Shared CRUD hooks
  const { confirmDelete, handleDeleteClick, handleConfirmDelete, isDeleting } = useOptimisticDelete<StaffMember>({
    queryKey: ['staff'],
    deleteFn: (id: string) => deleteStaff(id),
    getItemId: (member) => member.id,
    itemName: t('staff.itemName'),
  });

  const { isModalOpen, editingItem, handleAdd, handleEdit, handleModalSuccess } = useCrudModal<StaffMember>();

  const latestShift = useStaffSocket(selectedDept || 'all');

  const queryClient = useQueryClient();
  const staffQuery = useQuery({
    queryKey: ['staff', 'list', selectedDept],
    queryFn: async () => extractList<StaffMember>(await getStaff({ department: selectedDept || undefined })),
    placeholderData: keepPreviousData, // changing the department filter keeps the list on screen while it reloads
  });
  const staff = staffQuery.data ?? [];
  const loading = staffQuery.isPending;
  const refreshing = staffQuery.isFetching;
  const fetchStaff = staffQuery.refetch;

  const { data: timeline, isError: timelineError } = useQuery({
    queryKey: ['staff', 'shift-timeline'],
    queryFn: async () => {
      const res = (await getShiftTimeline()) as { data?: Record<string, Shift[]> };
      return res.data ?? {};
    },
    staleTime: 60_000,
  });

  useEffect(() => {
    if (latestShift) void queryClient.invalidateQueries({ queryKey: ['staff'] });
  }, [latestShift, queryClient]);

  const departments = [...new Set(staff.map((s) => s.department))];

  const filteredStaff = staff.filter((s) => {
    const matchesDept = !selectedDept || s.department === selectedDept;
    const matchesSearch = 
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.email.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesDept && matchesSearch;
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-pulse text-gray-500">{t('staff.loading')}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 relative">
      {/* ✅ Shared Confirm Delete Dialog */}
      <ConfirmDeleteDialog
        isOpen={!!confirmDelete}
        name={confirmDelete?.name || ''}
        itemType={t('staff.itemType')}
        onCancel={() => {}}
        onConfirm={handleConfirmDelete}
        isLoading={isDeleting}
      />

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users size={28} className="text-teal-500" aria-hidden="true" />
            {t('staff.title')}
          </h1>
          <p className="text-gray-500 text-sm">{t('staff.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { void fetchStaff(); }}
            className="flex items-center gap-2 bg-white text-gray-700 px-4 py-2 rounded-lg border hover:bg-gray-50 transition"
            disabled={refreshing}
            aria-label={t('staff.refreshLabel')}
          >
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} aria-hidden="true" />
            {t('staff.refresh')}
          </button>
          {canManage && (
            <button
              onClick={handleAdd}
              className="flex items-center gap-2 bg-teal-500 text-white px-4 py-2 rounded-lg hover:bg-teal-600 transition"
            >
              <Plus size={16} />
              {t('staff.modal.add')}
            </button>
          )}
        </div>
      </div>

      {/* Staff Modal */}
      <StaffModal
        isOpen={isModalOpen}
        onClose={() => { handleModalSuccess(); }}
        onSuccess={() => { void queryClient.invalidateQueries({ queryKey: ['staff'] }); handleModalSuccess(); }}
        initialData={editingItem ? {
          id: editingItem.id,
          name: editingItem.name,
          email: editingItem.email,
          phone: editingItem.phone || '',
          role: editingItem.role,
          department: editingItem.department,
          status: editingItem.isActive ? 'ACTIVE' : 'INACTIVE',
        } : undefined}
      />

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search size={16} className="absolute start-3 top-1/2 -translate-y-1/2 text-gray-500" aria-hidden="true" />
            <input
              type="text"
              placeholder={t('staff.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full ps-10 pe-4 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
              aria-label={t('staff.searchLabel')}
              autoComplete="off"
            />
          </div>
          <label htmlFor="dept-filter" className="sr-only">{t('staff.filterDepartment')}</label>
          <select
            id="dept-filter"
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 outline-none bg-white"
            aria-label={t('staff.filterDepartment')}
          >
            <option value="">{t('staff.allDepartments')}</option>
            {departments.map((dept) => (
              <option key={dept} value={dept}>{t(`departments.${dept}`, { defaultValue: dept })}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Today's shift coverage by department */}
      <section aria-label={t('staff.timelineSection')} className="mb-6">
        {timelineError ? (
          <div role="alert" className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm font-medium">
            {t('staff.timelineError')}
          </div>
        ) : (
          <ShiftTimeline timeline={timeline ?? null} />
        )}
      </section>

      {/* Mobile: staff cards (the table below is md and up) */}
      {filteredStaff.length > 0 && (
        <section aria-label={t('staff.cardsLabel')} className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6 md:hidden">
          {filteredStaff.map((member) => (
            <StaffCard key={member.id} member={member} />
          ))}
        </section>
      )}

      {/* Staff Table */}
      <StaffTable staff={filteredStaff} canManage={canManage} onEdit={handleEdit} onDelete={handleDeleteClick} />
      {filteredStaff.length === 0 && (
        <div className="bg-white rounded-xl shadow-sm border text-center py-20 text-gray-500">
          <Users size={48} className="mx-auto mb-4 opacity-50" aria-hidden="true" />
          <p>{t('staff.empty')}</p>
        </div>
      )}
    </div>
  );
};