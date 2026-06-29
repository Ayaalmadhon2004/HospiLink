import { useState } from 'react';
import { admitPatient } from '../../services/patientService';

interface AdmitPatientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: () => void;
}

export const AdmitPatientModal = ({ isOpen, onClose, onAdd }: AdmitPatientModalProps) => {
  const [formData, setFormData] = useState({
    name: '',
    age: '',
    gender: 'MALE',
    department: 'General',
    diagnosis: '',
    bedId: '',
    hospitalId: 'e4eb651b-fc3c-4284-a73d-9178e77195d8', // ← من الـ user المسجل دخول
    doctorId: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await admitPatient({
        name: formData.name,
        age: parseInt(formData.age),
        gender: formData.gender,
        department: formData.department,
        diagnosis: formData.diagnosis,
        bedId: formData.bedId || undefined,
        hospitalId: formData.hospitalId,
        doctorId: formData.doctorId || undefined
      });
      onAdd();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || 'فشل إدخال المريض');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-2xl w-full max-w-md shadow-xl">
        <h2 className="text-xl font-bold text-slate-800 mb-4">Admit New Patient</h2>
        
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl mb-4 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input 
            className="border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" 
            placeholder="Patient Name" 
            value={formData.name}
            onChange={e => setFormData({...formData, name: e.target.value})}
            required
          />
          
          <div className="flex gap-3">
            <input 
              className="border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none w-1/2" 
              placeholder="Age" 
              type="number"
              value={formData.age}
              onChange={e => setFormData({...formData, age: e.target.value})}
              required
            />
            <select 
              className="border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none w-1/2"
              value={formData.gender}
              onChange={e => setFormData({...formData, gender: e.target.value})}
            >
              <option value="MALE">Male</option>
              <option value="FEMALE">Female</option>
            </select>
          </div>

          <select 
            className="border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
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
            className="border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" 
            placeholder="Diagnosis" 
            value={formData.diagnosis}
            onChange={e => setFormData({...formData, diagnosis: e.target.value})}
            required
          />

          <input 
            className="border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" 
            placeholder="Bed ID (optional)" 
            value={formData.bedId}
            onChange={e => setFormData({...formData, bedId: e.target.value})}
          />

          <div className="flex justify-end gap-2 mt-4">
            <button 
              type="button" 
              onClick={onClose} 
              className="bg-slate-100 text-slate-700 px-4 py-2 rounded-xl hover:bg-slate-200 transition"
              disabled={loading}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="bg-hospital-navy text-white px-4 py-2 rounded-xl hover:bg-slate-800 transition disabled:opacity-50"
              disabled={loading}
            >
              {loading ? 'Admitting...' : 'Admit Patient'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};