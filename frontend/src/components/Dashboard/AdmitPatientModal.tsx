import { useState } from 'react';
import { admitPatient } from '../../services/patientService';

export const AdmitPatientModal = ({ isOpen, onClose, onAdd }: any) => {
  const [formData, setFormData] = useState({
    name: '', age: '', condition: '', bedId: '', hospitalId: '', physicianName: ''
  });

  if (!isOpen) return null;

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    try {
      await admitPatient(formData);
      onAdd(); // لتحديث الجدول بعد الإضافة
      onClose();
    } catch (error) {
      alert("فشل إدخال المريض، تأكدي من البيانات!");
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg w-96">
        <h2 className="text-xl font-bold mb-4">Admit New Patient</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input className="border p-2 rounded" placeholder="Patient Name" onChange={e => setFormData({...formData, name: e.target.value})} />
          <input className="border p-2 rounded" placeholder="Age" type="number" onChange={e => setFormData({...formData, age: parseInt(e.target.value)})} />
          <input className="border p-2 rounded" placeholder="Condition" onChange={e => setFormData({...formData, condition: e.target.value})} />
          <input className="border p-2 rounded" placeholder="Bed ID" onChange={e => setFormData({...formData, bedId: e.target.value})} />
          <input className="border p-2 rounded" placeholder="Physician Name" onChange={e => setFormData({...formData, physicianName: e.target.value})} />
          
          <div className="flex justify-end gap-2 mt-4">
            <button type="button" onClick={onClose} className="bg-gray-200 px-4 py-2 rounded">Cancel</button>
            <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded">Admit</button>
          </div>
        </form>
      </div>
    </div>
  );
};