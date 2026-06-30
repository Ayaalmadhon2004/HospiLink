import { useState, useEffect } from 'react';

// ✅ Types معرفة يدوياً - NO Prisma!
type BedStatus = 'AVAILABLE' | 'OCCUPIED' | 'MAINTENANCE';

interface Bed {
  id: string;
  bedNumber: string;
  status: BedStatus;
  wardId: string;
  patientId: string | null;
  createdAt: string;
  updatedAt: string;
}

interface BedWithDetails extends Bed {
  ward: { name: string };
  patient?: { name: string; id: string } | null;
}

const Beds = () => {
  const [beds, setBeds] = useState<BedWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedBed, setSelectedBed] = useState<BedWithDetails | null>(null);

  // جلب السراير
  const fetchBeds = async () => {
    try {
      const res = await fetch('/api/beds');
      const data = await res.json();
      if (data.success) setBeds(data.data);
    } catch (err) {
      console.error('Error fetching beds:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBeds();
  }, []);

  // تغيير حالة السرير
  const updateStatus = async (id: string, status: BedStatus, patientId?: string | null) => {
    try {
      const res = await fetch(`/api/beds/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, patientId }),
      });
      const data = await res.json();
      if (data.success) fetchBeds();
    } catch (error) {
      console.error('Error updating bed:', error);
    }
  };

  // حذف سرير
  const deleteBed = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا السرير؟')) return;
    try {
      const res = await fetch(`/api/beds/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) fetchBeds();
    } catch (error) {
      console.error('Error deleting bed:', error);
    }
  };

  const getStatusColor = (status: BedStatus) => {
    switch (status) {
      case 'AVAILABLE': return 'bg-green-100 text-green-800 border-green-200';
      case 'OCCUPIED': return 'bg-red-100 text-red-800 border-red-200';
      case 'MAINTENANCE': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: BedStatus) => {
    switch (status) {
      case 'AVAILABLE': return 'متاح';
      case 'OCCUPIED': return 'مشغول';
      case 'MAINTENANCE': return 'صيانة';
      default: return status;
    }
  };

  if (loading) return <div className="p-8 text-center">جاري التحميل...</div>;

  return (
    <div className="p-6" dir="rtl">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">إدارة السراير</h1>
        <button
          onClick={() => { setSelectedBed(null); setShowModal(true); }}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
        >
          + إضافة سرير
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-green-50 p-4 rounded-lg text-center">
          <div className="text-2xl font-bold text-green-600">
            {beds.filter(b => b.status === 'AVAILABLE').length}
          </div>
          <div className="text-sm text-green-700">متاح</div>
        </div>
        <div className="bg-red-50 p-4 rounded-lg text-center">
          <div className="text-2xl font-bold text-red-600">
            {beds.filter(b => b.status === 'OCCUPIED').length}
          </div>
          <div className="text-sm text-red-700">مشغول</div>
        </div>
        <div className="bg-yellow-50 p-4 rounded-lg text-center">
          <div className="text-2xl font-bold text-yellow-600">
            {beds.filter(b => b.status === 'MAINTENANCE').length}
          </div>
          <div className="text-sm text-yellow-700">صيانة</div>
        </div>
      </div>

      {/* Beds Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {beds.map((bed) => (
          <div
            key={bed.id}
            className={`border-2 rounded-xl p-4 shadow-sm hover:shadow-md transition ${getStatusColor(bed.status)}`}
          >
            <div className="flex justify-between items-start mb-3">
              <div>
                <h3 className="text-lg font-bold">سرير {bed.bedNumber}</h3>
                <p className="text-sm opacity-75">{bed.ward.name}</p>
              </div>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(bed.status)}`}>
                {getStatusText(bed.status)}
              </span>
            </div>

            {bed.patient && (
              <div className="mb-3 p-2 bg-white/50 rounded-lg">
                <p className="text-sm font-medium">المريض: {bed.patient.name}</p>
              </div>
            )}

            <div className="flex gap-2 mt-3">
              <button
                onClick={() => { setSelectedBed(bed); setShowModal(true); }}
                className="flex-1 bg-white/80 text-gray-700 px-3 py-1.5 rounded-lg text-sm hover:bg-white transition"
              >
                تعديل
              </button>
              <button
                onClick={() => deleteBed(bed.id)}
                className="flex-1 bg-white/80 text-red-600 px-3 py-1.5 rounded-lg text-sm hover:bg-white transition"
              >
                حذف
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      {showModal && (
        <BedModal
          bed={selectedBed}
          onClose={() => setShowModal(false)}
          onSuccess={fetchBeds}
        />
      )}
    </div>
  );
};

// Modal Component
const BedModal = ({ bed, onClose, onSuccess }: {
  bed: BedWithDetails | null;
  onClose: () => void;
  onSuccess: () => void;
}) => {
  const [bedNumber, setBedNumber] = useState(bed?.bedNumber || '');
  const [wardId, setWardId] = useState(bed?.wardId || '');
  const [status, setStatus] = useState<BedStatus>(bed?.status || 'AVAILABLE');
  const [wards, setWards] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    fetch('/api/wards').then(r => r.json()).then(d => {
      if (d.success) setWards(d.data);
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = bed ? `/api/beds/${bed.id}` : '/api/beds';
    const method = bed ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bedNumber, wardId, status }),
      });
      const data = await res.json();
      if (data.success) {
        onSuccess();
        onClose();
      }
    } catch (error) {
      console.error('Error saving bed:', error);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
        <h2 className="text-xl font-bold mb-4">
          {bed ? 'تعديل سرير' : 'إضافة سرير جديد'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">رقم السرير</label>
            <input
              type="text"
              value={bedNumber}
              onChange={e => setBedNumber(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">القسم</label>
            <select
              value={wardId}
              onChange={e => setWardId(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="">اختر القسم</option>
              {wards.map(w => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">الحالة</label>
            <select
              value={status}
              onChange={e => setStatus(e.target.value as BedStatus)}
              className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
            >
              <option value="AVAILABLE">متاح</option>
              <option value="OCCUPIED">مشغول</option>
              <option value="MAINTENANCE">صيانة</option>
            </select>
          </div>
          <div className="flex gap-3 mt-6">
            <button
              type="submit"
              className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700"
            >
              {bed ? 'حفظ التعديلات' : 'إضافة'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300"
            >
              إلغاء
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Beds;