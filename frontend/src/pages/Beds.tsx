// pages/Beds.tsx
// pages/Beds.tsx
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Plus, Search } from 'lucide-react';
import { BedModal } from '../components/BedModal';
import { BedStatsCards } from '../components/Beds/BedStatsCards';
import { BedsTable } from '../components/Beds/BedsTable';
import { getBedStatusConfig } from '../components/Beds/bedStatusConfig';
import { apiGet, apiDelete } from '../services/api';
import { apiGetAll } from '../services/paginate';
import type { ApiResponse } from '../types/api';
import type { Patient } from '../types/patient';
import { useOptimisticDelete, useCrudModal } from '../hooks/useCrud';
import { WardsPanel } from '../components/Wards/WardsPanel';
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

      <BedStatsCards beds={beds} />

      <WardsPanel />

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
              {f === 'ALL' ? t('beds.filterAll') : getBedStatusConfig(t, f as BedStatus).label}
            </button>
          ))}
        </div>
        <div className="relative flex-1 max-w-md">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
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

      <BedsTable beds={filteredBeds} onEdit={handleEdit} onDelete={handleDeleteClick} />

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