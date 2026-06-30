import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { admitPatient } from '../../services/patientService';
import { getAvailableBeds } from '../../services/bedService';
import { Bed } from 'lucide-react';

interface AdmitPatientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: () => void;
}

interface BedOption {
  id: string;
  bedNumber: string;
  wardName: string;
}

export const AdmitPatientModal = ({ isOpen, onClose, onAdd }: AdmitPatientModalProps) => {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    name: '',
    age: '',
    gender: 'MALE',
    department: 'General',
    diagnosis: '',
    bedId: '',
    hospitalId: 'e4eb651b-fc3c-4284-a73d-9178e77195d8',
  });
  const [beds, setBeds] = useState<BedOption[]>([]);
  const [loadingBeds, setLoadingBeds] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      fetchBeds();
    }
  }, [isOpen]);

  const fetchBeds = async () => {
    setLoadingBeds(true);
    try {
      const res = await getAvailableBeds();
      setBeds(res.data || []);
    } catch (err: any) {
      console.error('Failed to load beds:', err);
    } finally {
      setLoadingBeds(false);
    }
  };

  const mutation = useMutation({
    mutationFn: admitPatient,
    onSuccess: () => {
      // Invalidate patients list to trigger refetch
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      onAdd(); // Close modal + callback
      // Reset form
      setFormData({
        name: '',
        age: '',
        gender: 'MALE',
        department: 'General',
        diagnosis: '',
        bedId: '',
        hospitalId: 'e4eb651b-fc3c-4284-a73d-9178e77195d8',
      });
    },
    onError: (err: any) => {
      setError(err.response?.data?.message || 'Failed to admit patient');
    },
  });

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    mutation.mutate({
      ...formData,
      age: parseInt(formData.age),
      bedId: formData.bedId || undefined,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-2xl w-full max-w-md shadow-xl">
        <h2 className="text-xl font-bold text-hospital-navy mb-4">Admit New Patient</h2>

        {error && (
          <div className="bg-red-50 text-red-600 px-4 py-3 rounded-xl mb-4 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            className="border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-medical-teal outline-none"
            placeholder="Patient Name"
            value={formData.name}
            onChange={e => setFormData({...formData, name: e.target.value})}
            required
          />

          <div className="flex gap-3">
            <input
              className="border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-medical-teal outline-none w-1/2"
              placeholder="Age"
              type="number"
              value={formData.age}
              onChange={e => setFormData({...formData, age: e.target.value})}
              required
            />
            <select
              className="border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-medical-teal outline-none w-1/2"
              value={formData.gender}
              onChange={e => setFormData({...formData, gender: e.target.value})}
            >
              <option value="MALE">Male</option>
              <option value="FEMALE">Female</option>
            </select>
          </div>

          <select
            className="border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-medical-teal outline-none"
            value={formData.department}
            onChange={e => setFormData({...formData, department: e.target.value})}
          >
            <option value="Emergency">Emergency</option>
            <option value="ICU">ICU</option>
            <option value="Surgery">Surgery</option>
            <option value="Pediatrics">Pediatrics</option>
            <option value="Cardiology">Cardiology</option>
            <option value="General">General</option>
          </select>

          <input
            className="border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-medical-teal outline-none"
            placeholder="Diagnosis"
            value={formData.diagnosis}
            onChange={e => setFormData({...formData, diagnosis: e.target.value})}
            required
          />

          {/* Beds Dropdown */}
          <div className="relative">
            <select
              className="w-full border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-medical-teal outline-none appearance-none bg-white"
              value={formData.bedId}
              onChange={e => setFormData({...formData, bedId: e.target.value})}
              disabled={loadingBeds}
            >
              <option value="">Select Bed (optional)</option>
              {beds.map((bed) => (
                <option key={bed.id} value={bed.id}>
                  Bed {bed.bedNumber} - {bed.wardName}
                </option>
              ))}
            </select>
            <Bed size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-clinic-text/30 pointer-events-none" />
            {loadingBeds && (
              <span className="absolute right-10 top-1/2 -translate-y-1/2 text-xs text-clinic-text/40">Loading...</span>
            )}
          </div>

          <div className="flex justify-end gap-2 mt-4">
            <button
              type="button"
              onClick={onClose}
              className="bg-slate-100 text-clinic-text px-4 py-2 rounded-xl hover:bg-slate-200 transition"
              disabled={mutation.isPending}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="bg-hospital-navy text-white px-4 py-2 rounded-xl hover:bg-hospital-navy/90 transition disabled:opacity-50"
              disabled={mutation.isPending}
            >
              {mutation.isPending ? 'Admitting...' : 'Admit Patient'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};