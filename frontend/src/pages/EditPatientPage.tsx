import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getPatientById, updatePatient } from '../services/patientService';
import { ArrowLeft, Save, User } from 'lucide-react';

const DEPARTMENTS = ['Emergency', 'ICU', 'Surgery', 'Pediatrics', 'Cardiology', 'General'];
const GENDERS = ['MALE', 'FEMALE'];

export const EditPatientPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    age: '',
    gender: 'MALE',
    department: 'General',
    diagnosis: '',
    status: 'STABLE',
  });

  useEffect(() => {
    const fetchPatient = async () => {
      if (!id) return;
      try {
        setLoading(true);
        const res = await getPatientById(id);
        const p = res.data;
        setFormData({
          name: p.name || '',
          age: p.age?.toString() || '',
          gender: p.gender || 'MALE',
          department: p.department || 'General',
          diagnosis: p.diagnosis || '',
          status: p.status || 'STABLE',
        });
      } catch (err: any) {
        setError(err.response?.data?.message || 'Failed to load patient');
      } finally {
        setLoading(false);
      }
    };
    fetchPatient();
  }, [id]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setSaving(true);
    setError('');
    try {
      await updatePatient(id, {
        ...formData,
        age: parseInt(formData.age),
      });
      navigate(`/patients/${id}`);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update patient');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-clinic-bg">
        <div className="text-clinic-text/50">Loading...</div>
      </div>
    );
  }

  if (error && !formData.name) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-clinic-bg">
        <div className="bg-red-50 text-red-600 px-6 py-4 rounded-xl">
          {error}
          <button onClick={() => navigate(-1)} className="block mt-4 text-hospital-navy hover:underline">
            Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-clinic-bg p-8">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-clinic-text/70 hover:text-clinic-text mb-6 transition">
        <ArrowLeft size={20} />
        Back
      </button>

      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-hospital-navy/10 rounded-full flex items-center justify-center">
              <User size={24} className="text-hospital-navy" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-hospital-navy">Edit Patient</h1>
              <p className="text-clinic-text/50">Update patient information</p>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 px-4 py-3 rounded-xl mb-4 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="block text-sm font-medium text-clinic-text mb-1">Full Name</label>
              <input
                name="name"
                value={formData.name}
                onChange={handleChange}
                className="w-full border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-medical-teal outline-none"
                required
              />
            </div>

            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-clinic-text mb-1">Age</label>
                <input
                  name="age"
                  type="number"
                  value={formData.age}
                  onChange={handleChange}
                  className="w-full border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-medical-teal outline-none"
                  required
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-clinic-text mb-1">Gender</label>
                <select
                  name="gender"
                  value={formData.gender}
                  onChange={handleChange}
                  className="w-full border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-medical-teal outline-none"
                >
                  {GENDERS.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-clinic-text mb-1">Department</label>
              <select
                name="department"
                value={formData.department}
                onChange={handleChange}
                className="w-full border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-medical-teal outline-none"
              >
                {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-clinic-text mb-1">Diagnosis</label>
              <textarea
                name="diagnosis"
                value={formData.diagnosis}
                onChange={handleChange}
                rows={3}
                className="w-full border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-medical-teal outline-none resize-none"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-clinic-text mb-1">Status</label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="w-full border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-medical-teal outline-none"
              >
                <option value="STABLE">Stable</option>
                <option value="OBSERVATION">Observation</option>
                <option value="CRITICAL">Critical</option>
                <option value="DISCHARGED">Discharged</option>
              </select>
            </div>

            <div className="flex gap-3 mt-4">
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="flex-1 bg-slate-100 text-clinic-text py-3 rounded-xl hover:bg-slate-200 transition"
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 bg-hospital-navy text-white py-3 rounded-xl hover:bg-hospital-navy/90 transition flex items-center justify-center gap-2 disabled:opacity-50"
                disabled={saving}
              >
                <Save size={18} />
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};