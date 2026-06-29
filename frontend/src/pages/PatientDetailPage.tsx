import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getPatientById } from '../services/patientService';
import { ArrowLeft, User, Calendar, Bed, Stethoscope, Activity } from 'lucide-react';

const STATUS_COLORS = {
  STABLE: 'bg-green-100 text-green-700',
  OBSERVATION: 'bg-yellow-100 text-yellow-700',
  CRITICAL: 'bg-red-100 text-red-700',
  DISCHARGED: 'bg-gray-100 text-gray-500',
};

export const PatientDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [patient, setPatient] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchPatient = async () => {
      if (!id) return;
      try {
        setLoading(true);
        const res = await getPatientById(id);
        setPatient(res.data);
      } catch (err: any) {
        setError(err.response?.data?.message || 'فشل جلب بيانات المريض');
      } finally {
        setLoading(false);
      }
    };
    fetchPatient();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-slate-400">جاري التحميل...</div>
      </div>
    );
  }

  if (error || !patient) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="bg-red-50 text-red-600 px-6 py-4 rounded-xl">
          {error || 'المريض غير موجود'}
          <button 
            onClick={() => navigate('/dashboard')}
            className="block mt-4 text-blue-600 hover:underline"
          >
            العودة للـ Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      {/* Header */}
      <button 
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-slate-600 hover:text-slate-800 mb-6 transition"
      >
        <ArrowLeft size={20} />
        رجوع
      </button>

      <div className="max-w-4xl mx-auto">
        {/* Patient Header Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                <User size={32} className="text-blue-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-800">{patient.name}</h1>
                <p className="text-slate-500">{patient.patientCode}</p>
              </div>
            </div>
            <span className={`px-4 py-2 rounded-full text-sm font-medium ${STATUS_COLORS[patient.status as keyof typeof STATUS_COLORS]}`}>
              {patient.status}
            </span>
          </div>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Personal Info */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <User size={20} className="text-blue-600" />
              معلومات شخصية
            </h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-slate-500">العمر</span>
                <span className="font-medium">{patient.age} سنة</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">الجنس</span>
                <span className="font-medium">{patient.gender === 'MALE' ? 'ذكر' : 'أنثى'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">تاريخ الدخول</span>
                <span className="font-medium">
                  {new Date(patient.admissionDate).toLocaleDateString('ar-SA')}
                </span>
              </div>
            </div>
          </div>

          {/* Medical Info */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Stethoscope size={20} className="text-red-500" />
              معلومات طبية
            </h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-slate-500">القسم</span>
                <span className="font-medium">{patient.department}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">التشخيص</span>
                <span className="font-medium">{patient.diagnosis}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">الطبيب المعالج</span>
                <span className="font-medium">{patient.doctor?.name || 'غير محدد'}</span>
              </div>
            </div>
          </div>

          {/* Bed Info */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Bed size={20} className="text-green-600" />
              معلومات السرير
            </h2>
            {patient.bed ? (
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-slate-500">رقم السرير</span>
                  <span className="font-medium">{patient.bed.bedNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">الجناح</span>
                  <span className="font-medium">{patient.bed.wardName}</span>
                </div>
              </div>
            ) : (
              <p className="text-slate-400">لا يوجد سرير محجوز</p>
            )}
          </div>

          {/* Vitals (Placeholder) */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Activity size={20} className="text-purple-600" />
              العلامات الحيوية
            </h2>
            <p className="text-slate-400 text-sm">قريباً - سيتم إضافة قسم العلامات الحيوية</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button 
            onClick={() => navigate(`/patients/${id}/edit`)}
            className="bg-blue-600 text-white px-6 py-3 rounded-xl hover:bg-blue-700 transition"
          >
            تعديل البيانات
          </button>
          {patient.status !== 'DISCHARGED' && (
            <button 
              onClick={() => {/* discharge logic */}}
              className="bg-red-50 text-red-600 border border-red-200 px-6 py-3 rounded-xl hover:bg-red-100 transition"
            >
              تسريح المريض
            </button>
          )}
        </div>
      </div>
    </div>
  );
};