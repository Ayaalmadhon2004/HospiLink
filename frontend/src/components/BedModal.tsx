import { useEffect, useState } from "react";
import { apiFetch, apiGet } from '../services/api'; // ← استورد
import type { BedStatus, BedWithDetails, PatientOption } from "../types/bed";

export const BedModal = ({ bed, patients, onClose, onSuccess }: {
  bed: BedWithDetails | null;
  patients: PatientOption[];
  onClose: () => void;
  onSuccess: () => void;
}) => {
  const [bedNumber, setBedNumber] = useState(bed?.bedNumber || '');
  const [wardId, setWardId] = useState(bed?.wardId || '');
  const [status, setStatus] = useState<BedStatus>(bed?.status || 'AVAILABLE');
  const [selectedPatientId, setSelectedPatientId] = useState(bed?.patientId || '');
  const [wards, setWards] = useState<{ id: string; name: string }[]>([]);
  const [saving, setSaving] = useState(false);
  
  const [showWardDropdown, setShowWardDropdown] = useState(false);
  const [showPatientDropdown, setShowPatientDropdown] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);

  useEffect(() => {
    const fetchWards = async () => {
      try {
        const res = await apiGet('/wards'); // ← استخدم apiGet
        const data = await res.json();
        if (data.success) setWards(data.data);
      } catch (err) {
        console.error('Error:', err);
      }
    };
    fetchWards();
  }, []);

  useEffect(() => {
    if (selectedPatientId) {
      setStatus('OCCUPIED');
    } else if (!bed?.patientId) {
      setStatus('AVAILABLE');
    }
  }, [selectedPatientId, bed]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const url = bed ? `/beds/${bed.id}` : '/beds'; // ← بدون /api لأن apiFetch بيضيفه
    const method = bed ? 'PUT' : 'POST';

    try {
      const res = await apiFetch(url, { // ← استخدم apiFetch
        method,
        body: JSON.stringify({
          bedNumber,
          wardId,
          status,
          patientId: selectedPatientId || null
        }),
      });
      const data = await res.json();
      if (data.success) {
        onSuccess();
        onClose();
      }
    } catch (error) {
      console.error('Error saving bed:', error);
    } finally {
      setSaving(false);
    }
  };
  
  const selectedWard = wards.find(w => w.id === wardId);
  const selectedPatient = patients.find(p => p.id === selectedPatientId);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl p-6 w-full max-w-lg relative">
        <h2 className="text-xl font-bold text-gray-900 mb-1">
          {bed ? 'Edit Bed' : 'Add New Bed'}
        </h2>
        <p className="text-gray-500 text-sm mb-6">
          {bed ? `Update bed ${bed.bedNumber}` : 'Create a new hospital bed'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Bed Number */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Bed Number</label>
            <input
              type="text"
              value={bedNumber}
              onChange={e => setBedNumber(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
              placeholder="e.g. ICU-101"
              required
            />
          </div>

          {/* Ward - Custom Dropdown */}
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Ward / Department</label>
            <button
              type="button"
              onClick={() => {
                setShowWardDropdown(!showWardDropdown);
                setShowPatientDropdown(false);
                setShowStatusDropdown(false);
              }}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-left focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm bg-white flex justify-between items-center"
            >
              <span className={selectedWard ? 'text-gray-900' : 'text-gray-400'}>
                {selectedWard ? selectedWard.name : 'Select ward...'}
              </span>
              <svg className={`w-4 h-4 text-gray-400 transition ${showWardDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            
            {showWardDropdown && (
              <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {wards.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-gray-400">No wards available</div>
                ) : (
                  wards.map(w => (
                    <button
                      key={w.id}
                      type="button"
                      onClick={() => {
                        setWardId(w.id);
                        setShowWardDropdown(false);
                      }}
                      className={`w-full text-left px-3 py-2.5 text-sm hover:bg-blue-50 transition ${
                        wardId === w.id ? 'bg-blue-50 text-blue-600' : 'text-gray-700'
                      }`}
                    >
                      {w.name}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Patient - Custom Dropdown */}
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Assign Patient (Optional)</label>
            <button
              type="button"
              onClick={() => {
                setShowPatientDropdown(!showPatientDropdown);
                setShowWardDropdown(false);
                setShowStatusDropdown(false);
              }}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-left focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm bg-white flex justify-between items-center"
            >
              <span className={selectedPatient ? 'text-gray-900' : 'text-gray-400'}>
                {selectedPatient ? selectedPatient.name : '— Unassigned —'}
              </span>
              <svg className={`w-4 h-4 text-gray-400 transition ${showPatientDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            
            {showPatientDropdown && (
              <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedPatientId('');
                    setShowPatientDropdown(false);
                  }}
                  className={`w-full text-left px-3 py-2.5 text-sm hover:bg-blue-50 transition ${
                    !selectedPatientId ? 'bg-blue-50 text-blue-600' : 'text-gray-700'
                  }`}
                >
                  — Unassigned —
                </button>
                {patients.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setSelectedPatientId(p.id);
                      setShowPatientDropdown(false);
                    }}
                    className={`w-full text-left px-3 py-2.5 text-sm hover:bg-blue-50 transition ${
                      selectedPatientId === p.id ? 'bg-blue-50 text-blue-600' : 'text-gray-700'
                    }`}
                  >
                    {p.name}
                  </button>
                ))}
                {patients.length === 0 && (
                  <div className="px-3 py-2 text-sm text-gray-400">No unassigned patients</div>
                )}
              </div>
            )}
            <p className="text-xs text-gray-400 mt-1">
              {selectedPatientId ? 'Status will be set to Occupied' : 'Status will be Available'}
            </p>
          </div>

          {/* Status - Custom Dropdown */}
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Status</label>
            <button
              type="button"
              onClick={() => {
                if (!selectedPatientId) {
                  setShowStatusDropdown(!showStatusDropdown);
                  setShowWardDropdown(false);
                  setShowPatientDropdown(false);
                }
              }}
              disabled={!!selectedPatientId}
              className={`w-full border rounded-lg px-3 py-2.5 text-left outline-none text-sm flex justify-between items-center ${
                selectedPatientId 
                  ? 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed' 
                  : 'border-gray-300 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
              }`}
            >
              <span className={status ? 'text-gray-900' : 'text-gray-400'}>
                {status === 'AVAILABLE' ? 'Available' : status === 'OCCUPIED' ? 'Occupied' : status === 'CLEANING' ? 'Cleaning' : 'Maintenance'}
              </span>
              {!selectedPatientId && (
                <svg className={`w-4 h-4 text-gray-400 transition ${showStatusDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              )}
            </button>
            
            {showStatusDropdown && !selectedPatientId && (
              <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg">
                {(['AVAILABLE', 'OCCUPIED', 'CLEANING', 'MAINTENANCE'] as BedStatus[]).map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      setStatus(s);
                      setShowStatusDropdown(false);
                    }}
                    className={`w-full text-left px-3 py-2.5 text-sm hover:bg-blue-50 transition ${
                      status === s ? 'bg-blue-50 text-blue-600' : 'text-gray-700'
                    }`}
                  >
                    {s === 'AVAILABLE' ? 'Available' : s === 'OCCUPIED' ? 'Occupied' : s === 'CLEANING' ? 'Cleaning' : 'Maintenance'}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Buttons */}
          <div className="flex gap-3 mt-6 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-100 text-gray-700 py-2.5 rounded-lg hover:bg-gray-200 transition font-medium text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !wardId}
              className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg hover:bg-blue-700 transition disabled:opacity-50 font-medium text-sm"
            >
              {saving ? 'Saving...' : bed ? 'Save Changes' : 'Add Bed'}
            </button>
          </div>
        </form>

        {/* Click outside to close dropdowns */}
        {(showWardDropdown || showPatientDropdown || showStatusDropdown) && (
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => {
              setShowWardDropdown(false);
              setShowPatientDropdown(false);
              setShowStatusDropdown(false);
            }}
          />
        )}
      </div>
    </div>
  );
};