// pages/Beds.tsx
import { useState, useEffect, useCallback } from 'react';
import { BedDouble, Plus, Search, Filter, MoreHorizontal, User, Trash2, X, AlertTriangle } from 'lucide-react';
import { BedModal } from '../components/BedModal';
import { apiGet, apiDelete } from '../services/api';
import { toast } from 'sonner';
import type { BedStatus, BedWithDetails, PatientOption } from "../types/bed";

interface Ward {
  id: string;
  name: string;
}

const Beds = () => {
  const [beds, setBeds] = useState<BedWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedBed, setSelectedBed] = useState<BedWithDetails | null>(null);
  const [filter, setFilter] = useState<'ALL' | BedStatus>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [patients, setPatients] = useState<PatientOption[]>([]);
  const [_wards, setWards] = useState<Ward[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchBeds = useCallback(async () => {
    try {
      const data = await apiGet('/beds');
      if (data.success) setBeds(data.data);
    } catch (err: any) {
      console.error('Error fetching beds:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchPatients = useCallback(async () => {
    try {
      const data = await apiGet('/patients?status=OBSERVATION');
      if (data.success) {
        const unassigned = data.data.filter((p: any) => !p.bedId);
        setPatients(unassigned.map((p: any) => ({ id: p.id, name: p.name })));
      }
    } catch (err: any) {
      console.error('Error fetching patients:', err);
    }
  }, []);

  const fetchWards = useCallback(async () => {
    try {
      const data = await apiGet('/wards');
      if (data.success) setWards(data.data);
    } catch (err: any) {
      console.error('Error fetching wards:', err);
    }
  }, []);

  useEffect(() => {
    fetchBeds();
    fetchPatients();
    fetchWards();
  }, [fetchBeds, fetchPatients, fetchWards]);

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
        return { badge: 'bg-emerald-100 text-emerald-800', label: 'Available', dot: 'bg-emerald-500' };
      case 'OCCUPIED':
        return { badge: 'bg-rose-100 text-rose-800', label: 'Occupied', dot: 'bg-rose-500' };
      case 'MAINTENANCE':
        return { badge: 'bg-amber-100 text-amber-800', label: 'Maintenance', dot: 'bg-amber-500' };
      case 'CLEANING':
        return { badge: 'bg-blue-100 text-blue-800', label: 'Cleaning', dot: 'bg-blue-500' };
    }
  };

  // ✅ DELETE — sleek toast confirm dialog
  const handleDelete = (id: string, bedNumber: string) => {
    toast.custom(
      (t) => (
        <div className="bg-white rounded-xl shadow-xl border border-gray-100 p-5 w-[360px]">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-5 h-5 text-rose-500" />
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-gray-900 text-sm">Delete Bed {bedNumber}?</h4>
              <p className="text-gray-500 text-xs mt-1 leading-relaxed">
                This bed will be permanently removed. This action cannot be undone.
              </p>
            </div>
            <button
              onClick={() => toast.dismiss(t)}
              className="text-gray-400 hover:text-gray-600 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex gap-2 mt-4 justify-end">
            <button
              onClick={() => toast.dismiss(t)}
              className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              onClick={async () => {
                toast.dismiss(t);
                setDeletingId(id);
                try {
                  const data = await apiDelete(`/beds/${id}`);
                  if (data.success) {
                    toast.success(
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-emerald-50 flex items-center justify-center">
                          <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                        <span className="text-sm font-medium">Bed {bedNumber} deleted</span>
                      </div>,
                      { duration: 3000 }
                    );
                    fetchBeds();
                  } else {
                    toast.error(data.message || 'Failed to delete bed');
                  }
                } catch (error: any) {
                  toast.error(error.message || 'Error deleting bed');
                } finally {
                  setDeletingId(null);
                }
              }}
              className="px-3 py-1.5 text-xs font-medium text-white bg-rose-500 hover:bg-rose-600 rounded-lg transition shadow-sm"
            >
              Delete
            </button>
          </div>
        </div>
      ),
      { duration: Infinity, position: 'top-center' }
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" role="status" aria-label="Loading beds"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Beds & Wards</h1>
          <p className="text-gray-500 text-sm mt-1">Manage hospital beds and patient assignments</p>
        </div>
        <button
          onClick={() => { setSelectedBed(null); setShowModal(true); }}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg transition flex items-center gap-2 text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          Add Bed
        </button>
      </div>

      {/* Stats */}
      <section className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white rounded-xl shadow-sm border p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</p>
            </div>
            <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
              <BedDouble className="w-5 h-5 text-blue-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Available</p>
              <p className="text-2xl font-bold text-emerald-600 mt-1">{stats.available}</p>
            </div>
            <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center">
              <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Occupied</p>
              <p className="text-2xl font-bold text-rose-600 mt-1">{stats.occupied}</p>
            </div>
            <div className="w-10 h-10 bg-rose-50 rounded-lg flex items-center justify-center">
              <User className="w-5 h-5 text-rose-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Cleaning</p>
              <p className="text-2xl font-bold text-blue-600 mt-1">{stats.cleaning}</p>
            </div>
            <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
              <div className="w-3 h-3 rounded-full bg-blue-500"></div>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Maintenance</p>
              <p className="text-2xl font-bold text-amber-600 mt-1">{stats.maintenance}</p>
            </div>
            <div className="w-10 h-10 bg-amber-50 rounded-lg flex items-center justify-center">
              <Filter className="w-5 h-5 text-amber-600" />
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
                filter === f ? 'bg-slate-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-50 border'
              }`}
            >
              {f === 'ALL' ? 'All' : getStatusConfig(f as BedStatus).label}
            </button>
          ))}
        </div>
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by bed number or ward..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
          />
        </div>
      </section>

      {/* Beds Table */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left text-xs font-semibold text-gray-500 uppercase px-6 py-4">Bed</th>
              <th className="text-left text-xs font-semibold text-gray-500 uppercase px-6 py-4">Ward</th>
              <th className="text-left text-xs font-semibold text-gray-500 uppercase px-6 py-4">Status</th>
              <th className="text-left text-xs font-semibold text-gray-500 uppercase px-6 py-4">Patient</th>
              <th className="text-right text-xs font-semibold text-gray-500 uppercase px-6 py-4">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredBeds.map((bed) => {
              const config = getStatusConfig(bed.status);
              const isDeleting = deletingId === bed.id;
              return (
                <tr key={bed.id} className="hover:bg-gray-50 transition">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                        <BedDouble className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">Bed {bed.bedNumber}</p>
                        <p className="text-xs text-gray-500">ID: {bed.id.slice(0, 8)}</p>
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
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => { setSelectedBed(bed); setShowModal(true); }}
                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(bed.id, bed.bedNumber)}
                        disabled={isDeleting}
                        className="p-2 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition disabled:opacity-50"
                      >
                        {isDeleting ? (
                          <div className="w-4 h-4 border-2 border-rose-300 border-t-rose-600 rounded-full animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
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
            <p>No beds found</p>
          </div>
        )}
      </div>

      {showModal && (
        <BedModal
          bed={selectedBed}
          patients={patients}
          onClose={() => setShowModal(false)}
          onSuccess={() => { fetchBeds(); fetchPatients(); }}
        />
      )}
    </div>
  );
};

export default Beds;