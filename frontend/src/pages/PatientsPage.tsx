import { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { usePatients } from '../hooks/usePatients';
import { AdmitPatientModal } from '../components/Patients/AdmitPatientModal';
import { 
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, 
  Loader2, Search, UserPlus 
} from 'lucide-react';

const STATUS_COLORS: Record<string, string> = {
  STABLE: 'bg-green-100 text-green-700',
  OBSERVATION: 'bg-yellow-100 text-yellow-700',
  CRITICAL: 'bg-red-100 text-red-700',
  DISCHARGED: 'bg-gray-100 text-gray-500',
};

const ITEMS_PER_PAGE_OPTIONS = [10, 20, 50] as const;

interface Patient {
  id: string;
  patientCode: string;
  name: string;
  age: number;
  gender: string;
  department: string;
  diagnosis?: string;
  status: string;
  admissionDate: string;
  dischargeDate?: string;
  bedId?: string | null;
  bed?: {
    bedNumber: string;
    ward: { name: string };
  } | null;
}


// ─── Debounce hook ────────────────────────────────────────────────
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}

// ─── Pagination helper ────────────────────────────────────────────
function getPaginationRange(currentPage: number, totalPages: number, siblingCount = 1): (number | string)[] {
  const totalPageNumbers = 2 + 2 * siblingCount + 1;

  if (totalPages <= totalPageNumbers) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const leftSiblingIndex = Math.max(currentPage - siblingCount, 1);
  const rightSiblingIndex = Math.min(currentPage + siblingCount, totalPages);

  const showLeftDots = leftSiblingIndex > 2;
  const showRightDots = rightSiblingIndex < totalPages - 1;

  if (!showLeftDots && showRightDots) {
    const leftRange = Array.from({ length: 3 + 2 * siblingCount }, (_, i) => i + 1);
    return [...leftRange, '...', totalPages];
  }

  if (showLeftDots && !showRightDots) {
    const rightRange = Array.from(
      { length: 3 + 2 * siblingCount },
      (_, i) => totalPages - (3 + 2 * siblingCount) + 1 + i
    );
    return [1, '...', ...rightRange];
  }

  const middleRange = Array.from(
    { length: rightSiblingIndex - leftSiblingIndex + 1 },
    (_, i) => leftSiblingIndex + i
  );
  return [1, '...', ...middleRange, '...', totalPages];
}

// ─── Skeleton Row ─────────────────────────────────────────────────
const SkeletonRow = memo(() => (
  <tr className="animate-pulse">
    <td className="px-6 py-4"><div className="h-4 w-20 bg-slate-200 rounded" /></td>
    <td className="px-6 py-4"><div className="h-4 w-28 bg-slate-200 rounded" /></td>
    <td className="px-6 py-4"><div className="h-4 w-10 bg-slate-200 rounded" /></td>
    <td className="px-6 py-4"><div className="h-4 w-24 bg-slate-200 rounded" /></td>
    <td className="px-6 py-4"><div className="h-4 w-24 bg-slate-200 rounded" /></td>
    <td className="px-6 py-4"><div className="h-6 w-20 bg-slate-200 rounded-full" /></td>
  </tr>
));
SkeletonRow.displayName = 'SkeletonRow';

// ─── Status Badge ─────────────────────────────────────────────────
const StatusBadge = memo(({ status }: { status: string }) => {
  const colorClass = STATUS_COLORS[status] || STATUS_COLORS.STABLE;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${colorClass}`}
      role="status"
      aria-label={`Status: ${status}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current" aria-hidden="true" />
      {status}
    </span>
  );
});
StatusBadge.displayName = 'StatusBadge';

// ─── Main Component ───────────────────────────────────────────────
export const PatientsPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState('All');
  const [searchInput, setSearchInput] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  // Debounce search input (300ms)
  const search = useDebounce(searchInput, 300);

  const { patients, pagination, loading, isFetching, error } = usePatients({
    status: statusFilter,
    search: search || undefined,
    page,
    limit,
  });

  // ─── SEO: Dynamic title ─────────────────────────────────────────
  useEffect(() => {
    document.title = `Patients - Page ${page} | HospiLink`;
  }, [page]);

  const handlePatientAdded = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['patients'] });
    setIsModalOpen(false);
    setPage(1);
  }, [queryClient]);

  const handleStatusChange = useCallback((newStatus: string) => {
    setStatusFilter(newStatus);
    setPage(1);
  }, []);

  const handleSearchChange = useCallback((value: string) => {
    setSearchInput(value);
    setPage(1);
  }, []);

  const handleLimitChange = useCallback((newLimit: number) => {
    setLimit(newLimit);
    setPage(1);
  }, []);

  const totalPages = pagination?.totalPages || 1;
  const paginationRange = useMemo(
    () => getPaginationRange(page, totalPages),
    [page, totalPages]
  );

  const startItem = ((page - 1) * limit) + 1;
  const endItem = Math.min(page * limit, pagination?.totalCount || 0);

  return (
    <div className="p-6">
      {/* Header */}
      <header className="flex justify-between items-center mb-6 flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-hospital-navy">Patients</h1>
          <p className="text-clinic-text/50">Admitted patient records</p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-hospital-navy text-white px-4 py-2 rounded-lg hover:bg-hospital-navy/90 transition flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-hospital-navy focus:ring-offset-2"
          aria-label="Admit new patient"
        >
          <UserPlus size={18} aria-hidden="true" />
          Admit Patient
        </button>
      </header>

      <AdmitPatientModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onAdd={handlePatientAdded} 
      />

      {/* Filters */}
      <section className="flex flex-wrap gap-3 mb-6" aria-label="Patient filters">
        <div className="flex gap-2 flex-wrap" role="group" aria-label="Filter by status">
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
              {s}
            </button>
          ))}
        </div>

        <div className="relative ml-auto">
          <Search 
            size={16} 
            className="absolute left-3 top-1/2 -translate-y-1/2 text-clinic-text/30" 
            aria-hidden="true" 
          />
          <input
            type="text"
            placeholder="Search by name or ID..."
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="border border-slate-200 pl-9 pr-4 py-2 rounded-xl focus:ring-2 focus:ring-medical-teal focus:border-medical-teal outline-none w-64 transition"
            aria-label="Search patients by name or ID"
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
              aria-label="Loading page data"
            >
              <Loader2 className="w-6 h-6 animate-spin text-medical-teal" aria-hidden="true" />
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 text-clinic-text/50 text-sm uppercase">
                <tr>
                  <th scope="col" className="px-6 py-4 text-left font-medium">Patient ID</th>
                  <th scope="col" className="px-6 py-4 text-left font-medium">Name</th>
                  <th scope="col" className="px-6 py-4 text-left font-medium">Age</th>
                  <th scope="col" className="px-6 py-4 text-left font-medium">Department</th>
                  <th scope="col" className="px-6 py-4 text-left font-medium">Admission Date</th>
                  <th scope="col" className="px-6 py-4 text-left font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading && patients.length === 0 ? (
                  Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={`skeleton-${i}`} />)
                ) : error ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-4">
                      <div className="bg-red-50 text-red-600 px-4 py-3 rounded-xl" role="alert">
                        {error}
                      </div>
                    </td>
                  </tr>
                ) : patients.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-clinic-text/40">
                      <Search className="w-12 h-12 mx-auto mb-3 opacity-30" aria-hidden="true" />
                      <p>No patients found</p>
                      {search && <p className="text-sm mt-1">Try different search terms</p>}
                    </td>
                  </tr>
                ) : (
                  patients.map((patient: Patient) => (
                    <tr
                      key={patient.id}
                      className="hover:bg-slate-50 transition cursor-pointer focus-within:bg-slate-50"
                      onClick={() => navigate(`/patients/${patient.id}`)}
                      tabIndex={0}
                      role="link"
                      aria-label={`View details for ${patient.name}`}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          navigate(`/patients/${patient.id}`);
                        }
                      }}
                    >
                      <td className="px-6 py-4 font-mono text-sm text-clinic-text/60">
                        {patient.patientCode}
                      </td>
                      <td className="px-6 py-4 font-medium text-clinic-text">
                        {patient.name}
                      </td>
                      <td className="px-6 py-4 text-clinic-text/70">{patient.age}</td>
                      <td className="px-6 py-4 text-clinic-text/70">{patient.department}</td>
                      <td className="px-6 py-4 text-clinic-text/50 text-sm">
                        <time dateTime={patient.admissionDate}>
                          {new Date(patient.admissionDate).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </time>
                      </td>
                      <td className="px-6 py-4">
                        <StatusBadge status={patient.status} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination Footer */}
        {pagination && pagination.totalCount > 0 && (
          <footer className="px-6 py-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-4">
            {/* Info */}
            <div className="text-sm text-clinic-text/50">
              Showing <span className="font-medium text-clinic-text">{startItem}</span>
              {' - '}
              <span className="font-medium text-clinic-text">{endItem}</span>
              {' of '}
              <span className="font-medium text-clinic-text">{pagination.totalCount}</span> patients
            </div>

            {/* Items per page */}
            <div className="flex items-center gap-2 text-sm text-clinic-text/50">
              <label htmlFor="rows-per-page">Rows per page:</label>
              <select
                id="rows-per-page"
                value={limit}
                onChange={(e) => handleLimitChange(Number(e.target.value))}
                className="border border-slate-200 rounded-lg px-2 py-1 text-sm focus:ring-2 focus:ring-medical-teal outline-none bg-white"
                aria-label="Select number of rows per page"
              >
                {ITEMS_PER_PAGE_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>

            {/* Page Navigation */}
            <nav aria-label="Pagination" className="flex items-center gap-1">
              {/* First */}
              <button
                onClick={() => setPage(1)}
                disabled={page === 1 || isFetching}
                className="p-2 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition focus:outline-none focus:ring-2 focus:ring-medical-teal"
                aria-label="Go to first page"
                title="First page"
              >
                <ChevronsLeft size={16} aria-hidden="true" />
              </button>

              {/* Previous */}
              <button
                onClick={() => setPage(page - 1)}
                disabled={page === 1 || isFetching}
                className="p-2 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition focus:outline-none focus:ring-2 focus:ring-medical-teal"
                aria-label="Go to previous page"
                title="Previous page"
              >
                <ChevronLeft size={16} aria-hidden="true" />
              </button>

              {/* Page Numbers */}
              <div className="flex items-center gap-1 mx-1" role="group" aria-label="Page numbers">
                {paginationRange.map((item, idx) => (
                  item === '...' ? (
                    <span key={`dots-${idx}`} className="px-2 text-clinic-text/30" aria-hidden="true">...</span>
                  ) : (
                    <button
                      key={item}
                      onClick={() => setPage(item as number)}
                      disabled={isFetching}
                      className={`min-w-[32px] h-8 px-2 rounded-lg text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-medical-teal ${
                        page === item
                          ? 'bg-hospital-navy text-white'
                          : 'text-clinic-text hover:bg-slate-100'
                      } disabled:opacity-50`}
                      aria-label={`Go to page ${item}`}
                      aria-current={page === item ? 'page' : undefined}
                    >
                      {item}
                    </button>
                  )
                ))}
              </div>

              {/* Next */}
              <button
                onClick={() => setPage(page + 1)}
                disabled={page === totalPages || isFetching}
                className="p-2 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition focus:outline-none focus:ring-2 focus:ring-medical-teal"
                aria-label="Go to next page"
                title="Next page"
              >
                <ChevronRight size={16} aria-hidden="true" />
              </button>

              {/* Last */}
              <button
                onClick={() => setPage(totalPages)}
                disabled={page === totalPages || isFetching}
                className="p-2 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition focus:outline-none focus:ring-2 focus:ring-medical-teal"
                aria-label="Go to last page"
                title="Last page"
              >
                <ChevronsRight size={16} aria-hidden="true" />
              </button>
            </nav>
          </footer>
        )}
      </div>
    </div>
  );
};