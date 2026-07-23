// pages/StaffDirectoryPage.tsx
import { useState, useEffect, useCallback } from 'react';
import { 
  Users, RefreshCw, Search, Plus, Pencil, Trash2
} from 'lucide-react';
import { getStaff, deleteStaff } from '../services/staffService';
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
  shifts?: any[];
}

export const StaffDirectoryPage = () => {
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
    itemName: 'Staff member',
  });

  const { isModalOpen, editingItem, handleAdd, handleEdit, handleModalSuccess } = useCrudModal<StaffMember>();

  const latestShift = useStaffSocket(selectedDept || 'all');

  const fetchStaff = useCallback(async () => {
    try {
      setRefreshing(true);
      const res = await getStaff({ department: selectedDept || undefined });
      const data = res?.data?.data || res?.data || [];
      setStaff(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to fetch staff:', err);
      setStaff([]);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, [selectedDept]);

  useEffect(() => {
    fetchStaff();
  }, [fetchStaff]);

  useEffect(() => {
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
        <div className="animate-pulse text-gray-400">Loading staff directory...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8 relative">
      {/* ✅ Shared Confirm Delete Dialog */}
      <ConfirmDeleteDialog
        isOpen={!!confirmDelete}
        name={confirmDelete?.name || ''}
        itemType="staff member"
        onCancel={() => {}}
        onConfirm={handleConfirmDelete}
        isLoading={isDeleting}
      />

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users size={28} className="text-teal-500" aria-hidden="true" />
            Staff & Shifts
          </h1>
          <p className="text-gray-500 text-sm">Staff directory and shift management</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { fetchStaff(); }}
            className="flex items-center gap-2 bg-white text-gray-700 px-4 py-2 rounded-lg border hover:bg-gray-50 transition"
            disabled={refreshing}
            aria-label="Refresh staff directory"
          >
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} aria-hidden="true" />
            Refresh
          </button>
          <button
            onClick={handleAdd}
            className="flex items-center gap-2 bg-teal-500 text-white px-4 py-2 rounded-lg hover:bg-teal-600 transition"
          >
            <Plus size={16} />
            Add Staff
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
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
            <input
              type="text"
              placeholder="Search staff..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
              aria-label="Search staff by name or role"
              autoComplete="off"
            />
          </div>
          <label htmlFor="dept-filter" className="sr-only">Filter by department</label>
          <select
            id="dept-filter"
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 outline-none bg-white"
            aria-label="Filter by department"
          >
            <option value="">All Departments</option>
            {departments.map((dept) => (
              <option key={dept} value={dept}>{dept}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Staff Table */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th scope="col" className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">Name</th>
              <th scope="col" className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">Role</th>
              <th scope="col" className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">Department</th>
              <th scope="col" className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">Status</th>
              <th scope="col" className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">Current Shift</th>
              <th scope="col" className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">Actions</th>
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
                <td className="px-6 py-4 text-gray-600">{member.role}</td>
                <td className="px-6 py-4 text-gray-600">{member.department}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${member.isActive ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-500'}`}>
                    {member.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-6 py-4">
                  {member.shifts?.[0] ? (
                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-600">
                      {member.shifts[0].type}
                    </span>
                  ) : (
                    <span className="text-gray-400 text-sm">—</span>
                  )}
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition">
                    <button
                      onClick={() => handleEdit(member)}
                      className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                      title="Edit staff"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      onClick={() => handleDeleteClick(member.id, member.name)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                      title="Delete staff"
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
            <p>No staff members found</p>
          </div>
        )}
      </div>
    </div>
  );
};