// components/Wards/WardsPanel.tsx
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Building2, Pencil, Plus, Trash2 } from 'lucide-react';
import { ConfirmDeleteDialog } from '../ConfirmDeleteDialog';
import { WardModal } from './WardModal';
import { useAuthPermissions } from '../../hooks/useAuthPermissions';
import { useOptimisticDelete, useCrudModal } from '../../hooks/useCrud';
import { getWards, deleteWard, WARDS_KEY } from '../../services/wardService';
import type { Ward } from '../../types/ward';

const BEDS_KEY = ['beds'];

/** Ward list for the Beds page. Everyone sees it; add / rename / delete are ADMIN-only (mirrors the backend). */
export const WardsPanel = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { can } = useAuthPermissions();
  const canManage = can('wards:manage');

  const { data: wards = [] } = useQuery({ queryKey: WARDS_KEY, queryFn: getWards });
  const { isModalOpen, editingItem, handleAdd, handleEdit, setIsModalOpen } = useCrudModal<Ward>();
  const { confirmDelete, setConfirmDelete, handleDeleteClick, handleConfirmDelete, isDeleting } = useOptimisticDelete<Ward>({
    queryKey: WARDS_KEY,
    deleteFn: deleteWard,
    getItemId: (w) => w.id,
    itemName: t('wards.itemName'),
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: WARDS_KEY });
    queryClient.invalidateQueries({ queryKey: BEDS_KEY });
  };

  return (
    <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-5" aria-labelledby="wards-title">
      <ConfirmDeleteDialog
        isOpen={!!confirmDelete}
        name={confirmDelete?.name ?? ''}
        itemType={t('wards.itemType')}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={handleConfirmDelete}
        isLoading={isDeleting}
      />
      {canManage && (
        <WardModal
          key={editingItem?.id ?? 'new'}
          isOpen={isModalOpen}
          ward={editingItem}
          onClose={() => setIsModalOpen(false)}
          onSuccess={refresh}
        />
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h2 id="wards-title" className="text-lg font-bold text-gray-900">{t('wards.title')}</h2>
          <p className="text-gray-500 text-sm">{t('wards.subtitle')}</p>
        </div>
        {canManage && (
          <button onClick={handleAdd} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg transition flex items-center gap-2 text-sm font-medium">
            <Plus className="w-4 h-4" aria-hidden="true" />
            {t('wards.add')}
          </button>
        )}
      </div>

      {wards.length === 0 ? (
        <p className="text-sm text-gray-500">{t('wards.empty')}</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {wards.map((ward) => {
            const beds = ward._count?.beds ?? 0;
            return (
              <li key={ward.id} className="flex items-center gap-3 border border-slate-200 rounded-lg p-3">
                <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center shrink-0">
                  <Building2 className="w-4 h-4 text-blue-600" aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-gray-900 truncate">{ward.name}</p>
                  <p className="text-xs text-gray-500">
                    {ward.floor !== null && `${t('wards.floor', { floor: ward.floor })} · `}
                    {t('wards.bedCount', { count: beds })}
                  </p>
                </div>
                {canManage && (
                  <div className="flex gap-1">
                    <button onClick={() => handleEdit(ward)} aria-label={t('wards.edit', { name: ward.name })} className="p-2 rounded-lg text-gray-500 hover:bg-gray-100">
                      <Pencil className="w-4 h-4" aria-hidden="true" />
                    </button>
                    <button
                      onClick={() => handleDeleteClick(ward.id, ward.name)}
                      disabled={beds > 0}
                      title={beds > 0 ? t('wards.hasBeds') : undefined}
                      aria-label={t('wards.delete', { name: ward.name })}
                      className="p-2 rounded-lg text-red-600 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                    >
                      <Trash2 className="w-4 h-4" aria-hidden="true" />
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};
