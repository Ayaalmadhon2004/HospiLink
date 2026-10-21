// pages/StaffDirectoryPage.tsx
import { logger } from '../utils/logger';
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Users, RefreshCw, Search, Plus, Pencil, Trash2
} from 'lucide-react';
import { getStaff, deleteStaff } from '../services/staffService';
import { extractList } from '../types/api';
import type { Shift } from '../types/staff';
import { useStaffSocket } from '../hooks/useStaffSocket';
import { StaffModal } from '../components/Staff/StaffModal';
import { useOptimisticDelete, useCrudModal } from '../hooks/useCrud';
import { ConfirmDeleteDialog } from '../components/ConfirmDeleteDialog';

interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string;
  avatar?: string;
  phone?: string;
  isActive: boolean;
  shifts?: Shift[];
}

export const StaffDirectoryPage = () => {
  const { t } = useTranslation();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
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

  const fetchStaff = useCallback(async () => {
    try {
      setRefreshing(true);
      const res = await getStaff({ department: selectedDept || undefined });
      setStaff(extractList<StaffMember>(res));
    } catch (err) {
      logger.error('Failed to fetch staff:', err);
      setStaff([]);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, [selectedDept]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- effect intentionally syncs/fetches into state (data load or reset on prop change); restructuring would change behaviour
    fetchStaff();
  }, [fetchStaff]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- effect intentionally syncs/fetches into state (data load or reset on prop change); restructuring would change behaviour
    if (latestShift) fetchStaff();
  }, [latestShift, fetchStaff]);

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
        <div className="animate-pulse text-gray-400">{t('staff.loading')}</div>
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
            onClick={() => { fetchStaff(); }}
            className="flex items-center gap-2 bg-white text-gray-700 px-4 py-2 rounded-lg border hover:bg-gray-50 transition"
            disabled={refreshing}
            aria-label={t('staff.refreshLabel')}
          >
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} aria-hidden="true" />
            {t('staff.refresh')}
          </button>
          <button
            onClick={handleAdd}
            className="flex items-center gap-2 bg-teal-500 text-white px-4 py-2 rounded-lg hover:bg-teal-600 transition"
          >
            <Plus size={16} />
            {t('staff.modal.add')}
          </button>
        </div>
      </div>

      {/* Staff Modal */}
      <StaffModal
        isOpen={isModalOpen}
        onClose={() => { handleModalSuccess(); }}
        onSuccess={() => { fetchStaff(); handleModalSuccess(); }}
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
            <Search size={16} className="absolute start-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
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

      {/* Staff Table */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th scope="col" className="text-start text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">{t('staff.columns.name')}</th>
              <th scope="col" className="text-start text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">{t('staff.columns.role')}</th>
              <th scope="col" className="text-start text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">{t('staff.columns.department')}</th>
              <th scope="col" className="text-start text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">{t('staff.columns.status')}</th>
              <th scope="col" className="text-start text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">{t('staff.columns.currentShift')}</th>
              <th scope="col" className="text-end text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">{t('staff.columns.actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredStaff.map((member) => (
              <tr key={member.id} className="hover:bg-gray-50 transition group">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center text-teal-600 font-bold">
                      {member.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">{member.name}</div>
                      <div className="text-xs text-gray-400">{member.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 text-gray-600">{t(`staff.roles.${member.role}`, { defaultValue: member.role })}</td>
                <td className="px-6 py-4 text-gray-600">{t(`departments.${member.department}`, { defaultValue: member.department })}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${member.isActive ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-500'}`}>
                    {member.isActive ? t('staff.status.ACTIVE') : t('staff.status.INACTIVE')}
                  </span>
                </td>
                <td className="px-6 py-4">
                  {member.shifts?.[0] ? (
                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-600">
                      {t(`staff.shifts.${member.shifts[0].type}`, { defaultValue: member.shifts[0].type })}
                    </span>
                  ) : (
                    <span className="text-gray-400 text-sm">—</span>
                  )}
                </td>
                <td className="px-6 py-4 text-end">
                  <div className="flex items-center justify-end gap-2 md:opacity-0 md:group-hover:opacity-100 focus-within:opacity-100 transition">
                    <button
                      onClick={() => handleEdit(member)}
                      className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                      title={t('staff.edit')}
                      aria-label={t('staff.edit')}
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      onClick={() => handleDeleteClick(member.id, member.name)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                      title={t('staff.delete')}
                      aria-label={t('staff.delete')}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredStaff.length === 0 && (
          <div className="text-center py-20 text-gray-400">
            <Users size={48} className="mx-auto mb-4 opacity-50" aria-hidden="true" />
            <p>{t('staff.empty')}</p>
          </div>
        )}
      </div>
    </div>
  );
};