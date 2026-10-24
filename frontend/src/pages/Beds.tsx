// pages/Beds.tsx
// pages/Beds.tsx
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { BedDouble, Plus, Search, Filter, MoreHorizontal, User, Trash2 } from 'lucide-react';
import { BedModal } from '../components/BedModal';
import { apiGet, apiDelete } from '../services/api';
import { apiGetAll } from '../services/paginate';
import type { ApiResponse } from '../types/api';
import type { Patient } from '../types/patient';
import { useOptimisticDelete, useCrudModal } from '../hooks/useCrud';
import { ConfirmDeleteDialog } from '../components/ConfirmDeleteDialog';
import type { BedStatus, BedWithDetails, PatientOption } from "../types/bed";

const BEDS_KEY = ['beds'];
const UNASSIGNED_PATIENTS_KEY = ['beds', 'unassigned-patients'];

const Beds = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<'ALL' | BedStatus>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // ✅ Shared CRUD hooks
  const { confirmDelete, handleDeleteClick, handleConfirmDelete, isDeleting } = useOptimisticDelete<BedWithDetails>({
    queryKey: ['beds'],
    deleteFn: (id: string) => apiDelete(`/beds/${id}`),
    getItemId: (bed) => bed.id,
    itemName: t('beds.itemName'),
  });

  const { isModalOpen, editingItem, handleAdd, handleEdit, handleModalSuccess } = useCrudModal<BedWithDetails>();

  const { data: beds = [], isPending: loading } = useQuery({
    queryKey: BEDS_KEY,
    queryFn: async () => (await apiGetAll<BedWithDetails>('/beds')).data,
  });

  // Patients that can still be given a bed
  const { data: patients = [] } = useQuery({
    queryKey: UNASSIGNED_PATIENTS_KEY,
    queryFn: async (): Promise<PatientOption[]> => {
      const res = await apiGet<ApiResponse<Patient[]>>('/patients?status=OBSERVATION');
      return res.data.filter((p) => !p.bedId).map((p) => ({ id: p.id, name: p.name, patientCode: p.patientCode }));
    },
  });

  const filteredBeds = beds.filter(bed => {
    const matchesFilter = filter === 'ALL' || bed.status === filter;
    const matchesSearch = bed.bedNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
    bed.ward.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const stats = {
    total: beds.length,
    available: beds.filter(b => b.status === 'AVAILABLE').length,
    occupied: beds.filter(b => b.status === 'OCCUPIED').length,
    maintenance: beds.filter(b => b.status === 'MAINTENANCE').length,
    cleaning: beds.filter(b => b.status === 'CLEANING').length,
  };

  const getStatusConfig = (status: BedStatus) => {
    switch (status) {
      case 'AVAILABLE':
        return { badge: 'bg-emerald-50 text-emerald-800 ring-1 ring-inset ring-emerald-200', label: t('beds.status.AVAILABLE'), dot: 'bg-emerald-500' };
      case 'OCCUPIED':
        return { badge: 'bg-red-50 text-red-800 ring-1 ring-inset ring-red-200', label: t('beds.status.OCCUPIED'), dot: 'bg-red-500' };
      case 'MAINTENANCE':
        return { badge: 'bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200', label: t('beds.status.MAINTENANCE'), dot: 'bg-slate-500' };
      case 'CLEANING':
        return { badge: 'bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-200', label: t('beds.status.CLEANING'), dot: 'bg-amber-500' };
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" role="status" aria-label={t('beds.loading')}></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 relative p-4 md:p-8">
      {/* ✅ Shared Confirm Delete Dialog */}
      <ConfirmDeleteDialog
        isOpen={!!confirmDelete}
        name={confirmDelete?.name || ''}
        itemType={t('beds.itemType')}
        onCancel={() => {}}
        onConfirm={handleConfirmDelete}
        isLoading={isDeleting}
      />

      <div className="flex flex-wrap justify-between items-start gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('beds.title')}</h1>
          <p className="text-gray-500 text-sm mt-1">{t('beds.subtitle')}</p>
        </div>
        <button
          onClick={handleAdd}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg transition flex items-center gap-2 text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          {t('beds.add')}
        </button>
      </div>

      {/* Stats */}
      <section className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">{t('beds.stats.total')}</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</p>
            </div>
            <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
              <BedDouble className="w-5 h-5 text-blue-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">{t('beds.status.AVAILABLE')}</p>
              <p className="text-2xl font-bold text-emerald-600 mt-1">{stats.available}</p>
            </div>
            <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center">
              <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">{t('beds.status.OCCUPIED')}</p>
              <p className="text-2xl font-bold text-red-600 mt-1">{stats.occupied}</p>
            </div>
            <div className="w-10 h-10 bg-red-50 rounded-lg flex items-center justify-center">
              <User className="w-5 h-5 text-red-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">{t('beds.status.CLEANING')}</p>
              <p className="text-2xl font-bold text-amber-600 mt-1">{stats.cleaning}</p>
            </div>
            <div className="w-10 h-10 bg-amber-50 rounded-lg flex items-center justify-center">
              <div className="w-3 h-3 rounded-full bg-amber-500"></div>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">{t('beds.status.MAINTENANCE')}</p>
              <p className="text-2xl font-bold text-slate-600 mt-1">{stats.maintenance}</p>
            </div>
            <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
              <Filter className="w-5 h-5 text-slate-600" />
            </div>
          </div>
        </div>
      </section>

      {/* Filters & Search */}
      <section className="flex flex-col sm:flex-row gap-4">
        <div className="flex gap-2 flex-wrap">
          {(['ALL', 'AVAILABLE', 'OCCUPIED', 'CLEANING', 'MAINTENANCE'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                filter === f ? 'bg-hospital-navy text-white' : 'bg-white text-gray-600 hover:bg-gray-50 border'
              }`}
            >
              {f === 'ALL' ? t('beds.filterAll') : getStatusConfig(f as BedStatus).label}
            </button>
          ))}
        </div>
        <div className="relative flex-1 max-w-md">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder={t('beds.searchPlaceholder')}
            aria-label={t('beds.searchPlaceholder')}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full ps-10 pe-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
          />
        </div>
      </section>

      {/* Beds Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-start text-xs font-semibold text-gray-500 uppercase px-6 py-4">{t('beds.columns.bed')}</th>
              <th className="text-start text-xs font-semibold text-gray-500 uppercase px-6 py-4">{t('beds.columns.ward')}</th>
              <th className="text-start text-xs font-semibold text-gray-500 uppercase px-6 py-4">{t('beds.columns.status')}</th>
              <th className="text-start text-xs font-semibold text-gray-500 uppercase px-6 py-4">{t('beds.columns.patient')}</th>
              <th className="text-end text-xs font-semibold text-gray-500 uppercase px-6 py-4">{t('beds.columns.actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredBeds.map((bed) => {
              const config = getStatusConfig(bed.status);
              return (
                <tr key={bed.id} className="hover:bg-gray-50 transition">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                        <BedDouble className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{t('beds.bedLabel', { number: bed.bedNumber })}</p>
                        <p className="text-xs text-gray-500">{t('beds.idLabel', { id: bed.id.slice(0, 8) })}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">{bed.ward.name}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${config.badge}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`}></span>
                      {config.label}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {bed.patient ? (
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-xs font-bold">
                          {bed.patient.name.charAt(0)}
                        </div>
                        <span className="text-sm text-gray-700">{bed.patient.name}</span>
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-end">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleEdit(bed)}
                        aria-label={t('beds.editLabel', { number: bed.bedNumber })}
                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteClick(bed.id, t('beds.bedLabel', { number: bed.bedNumber }))}
                        aria-label={t('beds.deleteLabel', { number: bed.bedNumber })}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filteredBeds.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <BedDouble className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>{t('beds.empty')}</p>
          </div>
        )}
      </div>

      {isModalOpen && (
        <BedModal
          bed={editingItem}
          patients={patients}
          onClose={() => handleModalSuccess()}
          onSuccess={() => { void queryClient.invalidateQueries({ queryKey: BEDS_KEY }); handleModalSuccess(); }}
        />
      )}
    </div>
  );
};

export default Beds;