// pages/IncidentsPage.tsx
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Plus, Search, Activity } from 'lucide-react';
import { IncidentModal } from '../components/IncidentModal';
import { IncidentCard } from '../components/Incidents/IncidentCard';
import { ConfirmDeleteDialog } from '../components/ConfirmDeleteDialog';
import { useIncidentsPage } from '../hooks/useIncidentsPage';

export const IncidentsPage = () => {
  const { t } = useTranslation();
  const {
    incidents, loading, filteredIncidents, searchQuery, setSearchQuery, filterSeverity, setFilterSeverity,
    updatingStatus, handleStatusChange, timeAgo, confirmDelete, handleDeleteClick, handleConfirmDelete, isDeleting,
    isModalOpen, editingItem, handleAdd, handleEdit, handleModalSuccess, handleModalSuccessWithRefresh,
  } = useIncidentsPage();


  if (loading && incidents.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-pulse text-gray-500">{t('incidents.loading')}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      {/* Confirm Delete Dialog */}
      <ConfirmDeleteDialog
        isOpen={!!confirmDelete}
        name={confirmDelete?.name || ''}
        itemType={t('incidents.itemType')}
        onCancel={() => {}}
        onConfirm={handleConfirmDelete}
        isLoading={isDeleting}
      />

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <AlertTriangle size={28} className="text-red-600" />
            {t('incidents.title')}
          </h1>
          <p className="text-gray-500 text-sm">{t('incidents.subtitle')}</p>
        </div>
        <button
          onClick={handleAdd}
          className="flex items-center gap-2 bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition"
        >
          <Plus size={16} />
          {t('incidents.report')}
        </button>
      </div>

      {/* Incident Modal */}
      <IncidentModal
        isOpen={isModalOpen}
        onClose={() => {
          handleModalSuccess();
        }}
        onSuccess={handleModalSuccessWithRefresh}
        initialData={
          editingItem
            ? {
                id: editingItem.id,
                title: editingItem.title,
                type: editingItem.type,
                severity: editingItem.severity,
                location: editingItem.location,
                reportedBy: editingItem.reportedBy || '',
                description: editingItem.description || '',
              }
            : undefined
        }
      />

      {/* Code Orange Alert */}
      {incidents.some((i) => i.severity === 'CRITICAL') && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
          <div className="flex-1">
            <p className="font-semibold text-red-700">
              {t('incidents.codeOrange')}
            </p>
          </div>
          <span className="text-sm text-red-600">{t('incidents.regionalCommand')}</span>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search
            size={16}
            className="absolute start-3 top-1/2 -translate-y-1/2 text-gray-500"
          />
          <input
            type="text"
            placeholder={t('incidents.searchPlaceholder')}
            aria-label={t('incidents.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full ps-10 pe-4 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 outline-none"
          />
        </div>
        <select
          value={filterSeverity}
          onChange={(e) => setFilterSeverity(e.target.value)}
          aria-label={t('incidents.filterSeverity')}
          className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 outline-none bg-white"
        >
          <option value="">{t('incidents.allSeverities')}</option>
          <option value="CRITICAL">{t('incidents.severity.CRITICAL')}</option>
          <option value="ELEVATED">{t('incidents.severity.ELEVATED')}</option>
          <option value="MODERATE">{t('incidents.severity.MODERATE')}</option>
          <option value="LOW">{t('incidents.severity.LOW')}</option>
        </select>
      </div>

      {/* Incidents List */}
      <div className="space-y-4">
        {filteredIncidents.length > 0 ? (
          filteredIncidents.map((incident) => (
            <IncidentCard
              key={incident.id}
              incident={incident}
              updating={updatingStatus === incident.id}
              timeAgo={timeAgo}
              onStatusChange={handleStatusChange}
              onEdit={handleEdit}
              onDelete={handleDeleteClick}
            />
          ))
        ) : (
          <div className="text-center py-20 text-gray-500">
            <Activity size={48} className="mx-auto mb-4 opacity-50" />
            <p>{t('incidents.empty')}</p>
          </div>
        )}
      </div>
    </div>
  );
};
