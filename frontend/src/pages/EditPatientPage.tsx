import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getPatientById, updatePatient } from '../services/patientService';
import { getResponseData } from '../types/api';
import { ArrowLeft, Save, User } from 'lucide-react';

const DEPARTMENTS = ['Emergency', 'ICU', 'Surgery', 'Pediatrics', 'Cardiology', 'General'];
const GENDERS = ['MALE', 'FEMALE'];

export const EditPatientPage = () => {
  const { t } = useTranslation();
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
      } catch (err: unknown) {
        setError(getResponseData(err)?.message || t('patientDetail.loadError'));
      } finally {
        setLoading(false);
      }
    };
    fetchPatient();
  }, [id, t]);

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
    } catch (err: unknown) {
      setError(getResponseData(err)?.message || t('editPatient.updateError'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-clinic-bg">
        <div className="text-clinic-text/50">{t('common.loading')}</div>
      </div>
    );
  }

  if (error && !formData.name) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-clinic-bg">
        <div className="bg-red-50 text-red-600 px-6 py-4 rounded-xl">
          {error}
          <button onClick={() => navigate(-1)} className="block mt-4 text-hospital-navy hover:underline">
            {t('common.back')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-clinic-bg p-4 md:p-8">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-clinic-text/70 hover:text-clinic-text mb-6 transition">
        <ArrowLeft size={20} className="rtl:rotate-180" aria-hidden="true" />
        {t('common.back')}
      </button>

      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-hospital-navy/10 rounded-full flex items-center justify-center">
              <User size={24} className="text-hospital-navy" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-hospital-navy">{t('editPatient.title')}</h1>
              <p className="text-clinic-text/50">{t('editPatient.subtitle')}</p>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 px-4 py-3 rounded-xl mb-4 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="block text-sm font-medium text-clinic-text mb-1">{t('editPatient.fullName')}</label>
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
                <label className="block text-sm font-medium text-clinic-text mb-1">{t('editPatient.age')}</label>
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
                <label className="block text-sm font-medium text-clinic-text mb-1">{t('editPatient.gender')}</label>
                <select
                  name="gender"
                  value={formData.gender}
                  onChange={handleChange}
                  className="w-full border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-medical-teal outline-none"
                >
                  {GENDERS.map(g => <option key={g} value={g}>{t(`gender.${g}`)}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-clinic-text mb-1">{t('editPatient.department')}</label>
              <select
                name="department"
                value={formData.department}
                onChange={handleChange}
                className="w-full border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-medical-teal outline-none"
              >
                {DEPARTMENTS.map(d => <option key={d} value={d}>{t(`departments.${d}`, { defaultValue: d })}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-clinic-text mb-1">{t('editPatient.diagnosis')}</label>
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
              <label className="block text-sm font-medium text-clinic-text mb-1">{t('editPatient.status')}</label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="w-full border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-medical-teal outline-none"
              >
                <option value="STABLE">{t('status.STABLE')}</option>
                <option value="OBSERVATION">{t('status.OBSERVATION')}</option>
                <option value="CRITICAL">{t('status.CRITICAL')}</option>
                <option value="DISCHARGED">{t('status.DISCHARGED')}</option>
              </select>
            </div>

            <div className="flex gap-3 mt-4">
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="flex-1 bg-slate-100 text-clinic-text py-3 rounded-xl hover:bg-slate-200 transition"
                disabled={saving}
              >
                {t('common.cancel')}
              </button>
              <button
                type="submit"
                className="flex-1 bg-hospital-navy text-white py-3 rounded-xl hover:bg-hospital-navy/90 transition flex items-center justify-center gap-2 disabled:opacity-50"
                disabled={saving}
              >
                <Save size={18} />
                {saving ? t('common.saving') : t('editPatient.save')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};