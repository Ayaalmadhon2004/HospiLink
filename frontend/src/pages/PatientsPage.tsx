import { ExportMenu } from '../components/Export/ExportMenu';
import { useTranslation } from 'react-i18next';
import { usePatientsPage } from '../hooks/usePatientsPage';
import { AdmitPatientModal } from '../components/Patients/AdmitPatientModal';
import { PatientsPagination } from '../components/Patients/PatientsPagination';
import { PatientsTableBody } from '../components/Patients/PatientsTableBody';
import { Loader2, Search, UserPlus } from 'lucide-react';

// ─── Main Component ───────────────────────────────────────────────
export const PatientsPage = () => {
  const { t } = useTranslation();
  const {
    statusFilter, searchInput, search, isModalOpen, setIsModalOpen, page, setPage, limit,
    patients, pagination, loading, isFetching, error,
    handlePatientAdded, handleStatusChange, handleSearchChange, handleLimitChange,
    totalPages, paginationRange, startItem, endItem,
  } = usePatientsPage();

  return (
    <div className="p-6">
      {/* Header */}
      <header className="flex justify-between items-center mb-6 flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-hospital-navy">{t('patients.title')}</h1>
          <p className="text-slate-500">{t('patients.subtitle')}</p>
        </div>

        <div className="flex items-center gap-2">
          <ExportMenu type="patients" />
          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-hospital-navy text-white px-4 py-2 rounded-lg hover:bg-hospital-navy/90 transition flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-hospital-navy focus:ring-offset-2"
            aria-label={t('patients.admitLabel')}
          >
            <UserPlus size={18} aria-hidden="true" />
            {t('patients.admit')}
          </button>
        </div>
      </header>

      <AdmitPatientModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onAdd={handlePatientAdded} 
      />

      {/* Filters */}
      <section className="flex flex-wrap gap-3 mb-6" aria-label={t('patients.filtersLabel')}>
        <div className="flex gap-2 flex-wrap" role="group" aria-label={t('patients.filterByStatus')}>
          {['All', 'Stable', 'Observation', 'Critical', 'Discharged'].map((s) => (
            <button
              key={s}
              onClick={() => handleStatusChange(s)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-hospital-navy focus:ring-offset-2 ${
                statusFilter === s
                  ? 'bg-hospital-navy text-white'
                  : 'bg-white text-clinic-text hover:bg-slate-100'
              }`}
              aria-pressed={statusFilter === s}
            >
              {t(`patients.filters.${s}`)}
            </button>
          ))}
        </div>

        <div className="relative ms-auto">
          <Search 
            size={16} 
            className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" 
            aria-hidden="true" 
          />
          <input
            type="search"
            name="patient-search"
            placeholder={t('patients.searchPlaceholder')}
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="border border-slate-200 ps-9 pe-4 py-2 rounded-xl focus:ring-2 focus:ring-medical-teal focus:border-medical-teal outline-none w-64 transition"
            aria-label={t('patients.searchLabel')}
            autoComplete="off"
          />
        </div>
      </section>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="relative">
          {/* Loading overlay for page changes */}
          {isFetching && !loading && (
            <div 
              className="absolute inset-0 bg-white/60 flex items-center justify-center z-10 rounded-2xl"
              role="status"
              aria-label={t('patients.loadingPage')}
            >
              <Loader2 className="w-6 h-6 animate-spin text-medical-teal" aria-hidden="true" />
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 text-slate-500 text-sm uppercase">
                <tr>
                  <th scope="col" className="px-6 py-4 text-start font-medium">{t('patients.columns.patientId')}</th>
                  <th scope="col" className="px-6 py-4 text-start font-medium">{t('patients.columns.name')}</th>
                  <th scope="col" className="px-6 py-4 text-start font-medium">{t('patients.columns.age')}</th>
                  <th scope="col" className="px-6 py-4 text-start font-medium">{t('patients.columns.department')}</th>
                  <th scope="col" className="px-6 py-4 text-start font-medium">{t('patients.columns.admissionDate')}</th>
                  <th scope="col" className="px-6 py-4 text-start font-medium">{t('patients.columns.status')}</th>
                </tr>
              </thead>
              <PatientsTableBody patients={patients} loading={loading} error={error} search={search} />
            </table>
          </div>
        </div>

        {/* Pagination Footer */}
        {pagination && pagination.totalCount > 0 && (
          <PatientsPagination
            page={page}
            limit={limit}
            totalPages={totalPages}
            totalCount={pagination.totalCount}
            startItem={startItem}
            endItem={endItem}
            paginationRange={paginationRange}
            isFetching={isFetching}
            onPageChange={setPage}
            onLimitChange={handleLimitChange}
          />
        )}
      </div>
    </div>
  );
};
