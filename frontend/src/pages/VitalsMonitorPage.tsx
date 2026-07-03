import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, Plus, RefreshCw, ChevronDown } from 'lucide-react';
import { getVitals, getCriticalAlerts, recordVitals } from '../services/vitalsService';
import { getPatients } from '../services/patientService';
import { VitalsCard } from '../components/Vitals/VitalsCard';
import { VitalsChart } from '../components/Vitals/VitalsChart';
import { AlertsPanel } from '../components/Vitals/AlertsPanel';
import { useVitalsSocket } from '../hooks/useVitalsSocket';

// ─── Types ─────────────────────────────────────────────────────────────

interface Patient {
  id: string;
  name: string;
  patientCode: string;
  department: string;
}

interface VitalRecord {
  id: string;
  recordedAt: string;
  heartRate: number | null;
  systolicBP: number | null;
  diastolicBP: number | null;
  spO2: number | null;
  temperature: number | null;
  respiratoryRate: number | null;
  isCritical: boolean;
}

interface AlertItem {
  id: string;
  patient: { name: string; patientCode: string; department: string };
  alertType: string;
  recordedAt: string;
  heartRate?: number;
  systolicBP?: number;
  spO2?: number;
}

// ─── Helpers ───────────────────────────────────────────────────────────
const ensureArray = <T,>(value: unknown): T[] => {
  if (Array.isArray(value)) return value as T[];
  return [];
};

const mergeVitals = (existing: VitalRecord[], incoming: VitalRecord[]): VitalRecord[] => {
  const combined = [...existing, ...incoming];
  const seen = new Set<string>();
  return combined.filter((v) => {
    if (!v?.id) return false;
    if (seen.has(v.id)) return false;
    seen.add(v.id);
    return true;
  }).slice(0, 20);
};

// ─── Component ─────────────────────────────────────────────────────────

export const VitalsMonitorPage = () => {
  const navigate = useNavigate();

  // ── Core State ──────────────────────────────────────────────────────
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<string>('');
  const [vitals, setVitals] = useState<VitalRecord[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // ── Form State ──────────────────────────────────────────────────────
  const [formData, setFormData] = useState({
    heartRate: '',
    systolicBP: '',
    diastolicBP: '',
    spO2: '',
    temperature: '',
    respiratoryRate: '',
    notes: '',
  });

  // ── Real-time Socket ────────────────────────────────────────────────
  const latestVital = useVitalsSocket(selectedPatient || '');

  // ── Effects ───────────────────────────────────────────────────────────

  /** Socket: add new vital to history without replacing */
  useEffect(() => {
    if (latestVital && selectedPatient) {
      setVitals((prev) => {
        const safePrev = ensureArray<VitalRecord>(prev);
        const newVital = latestVital as VitalRecord;
        const exists = safePrev.some((v) => v?.id === newVital?.id);
        if (exists) return safePrev;
        return [newVital, ...safePrev].slice(0, 20);
      });
    }
  }, [latestVital, selectedPatient]);

  /** Fetch patients + alerts (polling every 30s) */
  const fetchData = useCallback(async () => {
    try {
      setRefreshing(true);
      const [patientsRes, alertsRes] = await Promise.all([
        getPatients(),
        getCriticalAlerts(),
      ]);
      setPatients(ensureArray<Patient>(patientsRes?.data ?? patientsRes));
      setAlerts(ensureArray<AlertItem>(alertsRes?.data ?? alertsRes));
    } catch (err) {
      console.error('Failed to fetch data:', err);
      setPatients([]);
      setAlerts([]);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, []);

  /** Fetch historical vitals — merge with existing, don't replace */
  const fetchVitals = useCallback(async (patientId: string) => {
    if (!patientId) {
      setVitals([]);
      return;
    }
    setLoading(true);
    try {
      const res = await getVitals({ patientId, limit: 20 });
      const data = ensureArray<VitalRecord>(res?.data ?? res);
      // ✅ Merge with existing vitals instead of replacing
      setVitals((prev) => mergeVitals(ensureArray<VitalRecord>(prev), data));
    } catch (err) {
      console.error('Failed to fetch vitals:', err);
      // ❌ Don't clear vitals on error
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  useEffect(() => {
    if (selectedPatient) {
      fetchVitals(selectedPatient);
    } else {
      setVitals([]);
    }
  }, [selectedPatient, fetchVitals]);

  // ── Handlers ────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatient || submitting) return;

    setSubmitting(true);
    try {
      const res = await recordVitals({
        patientId: selectedPatient,
        heartRate: formData.heartRate ? parseInt(formData.heartRate) : undefined,
        systolicBP: formData.systolicBP ? parseInt(formData.systolicBP) : undefined,
        diastolicBP: formData.diastolicBP ? parseInt(formData.diastolicBP) : undefined,
        spO2: formData.spO2 ? parseFloat(formData.spO2) : undefined,
        temperature: formData.temperature ? parseFloat(formData.temperature) : undefined,
        respiratoryRate: formData.respiratoryRate ? parseInt(formData.respiratoryRate) : undefined,
        notes: formData.notes || undefined,
      });

      // ✅ Add the new vital from response directly to state
      if (res?.data) {
        setVitals((prev) => {
          const safePrev = ensureArray<VitalRecord>(prev);
          const newVital = res.data as VitalRecord;
          const exists = safePrev.some((v) => v?.id === newVital?.id);
          if (exists) return safePrev;
          return [newVital, ...safePrev].slice(0, 20);
        });
      }

      // Reset form
      setShowForm(false);
      setFormData({
        heartRate: '',
        systolicBP: '',
        diastolicBP: '',
        spO2: '',
        temperature: '',
        respiratoryRate: '',
        notes: '',
      });

      // ❌ Don't call fetchVitals here — it might replace our new vital!
      await fetchData(); // Only refresh alerts
    } catch (err: any) {
      alert(err.message || 'Failed to record vitals');
    } finally {
      setSubmitting(false);
    }
  };

  const latestVitals = vitals[0];

  // ── Render ──────────────────────────────────────────────────────────

  if (loading && patients.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-clinic-bg">
        <div className="animate-pulse text-clinic-text/50">Loading vitals monitor...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-clinic-bg p-6 md:p-8">
      {/* ── Header ────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-hospital-navy flex items-center gap-2">
            <Activity size={28} className="text-medical-teal" />
            Vitals Monitor
          </h1>
          <p className="text-clinic-text/50 text-sm">Real-time patient vitals tracking & alerts</p>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 bg-white text-clinic-text px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 transition shadow-sm"
          disabled={refreshing}
        >
          <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* ── Alerts Panel ──────────────────────────────────────────────── */}
      <div className="mb-6">
        <AlertsPanel alerts={alerts} />
      </div>

      {/* ── Patient Selector ──────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6">
        <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center">
          <div className="relative flex-1">
            <select
              value={selectedPatient}
              onChange={(e) => setSelectedPatient(e.target.value)}
              className="w-full appearance-none border border-slate-200 p-3 pr-10 rounded-xl focus:ring-2 focus:ring-medical-teal outline-none bg-white"
            >
              <option value="">Select Patient</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} • {p.patientCode} • {p.department}
                </option>
              ))}
            </select>
            <ChevronDown
              size={16}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-clinic-text/40 pointer-events-none"
            />
          </div>

          {selectedPatient && (
            <button
              onClick={() => setShowForm(!showForm)}
              className="bg-hospital-navy text-white px-6 py-3 rounded-xl hover:bg-hospital-navy/90 transition flex items-center justify-center gap-2 shadow-sm"
            >
              <Plus size={18} />
              {showForm ? 'Hide Form' : 'Record Vitals'}
            </button>
          )}
        </div>
      </div>

      {/* ── Record Form ───────────────────────────────────────────────── */}
      {showForm && selectedPatient && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6 animate-in fade-in slide-in-from-top-2 duration-200">
          <h3 className="text-lg font-bold text-hospital-navy mb-4">Record New Vitals</h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-clinic-text/60 mb-1">
                Heart Rate <span className="text-xs text-clinic-text/30">(60-100)</span>
              </label>
              <input
                type="number"
                min="0"
                max="300"
                value={formData.heartRate}
                onChange={(e) => setFormData({ ...formData, heartRate: e.target.value })}
                className="w-full border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-medical-teal outline-none"
                placeholder="72"
              />
            </div>
            <div>
              <label className="block text-sm text-clinic-text/60 mb-1">
                Systolic BP <span className="text-xs text-clinic-text/30">(90-140)</span>
              </label>
              <input
                type="number"
                min="0"
                max="300"
                value={formData.systolicBP}
                onChange={(e) => setFormData({ ...formData, systolicBP: e.target.value })}
                className="w-full border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-medical-teal outline-none"
                placeholder="120"
              />
            </div>
            <div>
              <label className="block text-sm text-clinic-text/60 mb-1">
                Diastolic BP <span className="text-xs text-clinic-text/30">(60-90)</span>
              </label>
              <input
                type="number"
                min="0"
                max="200"
                value={formData.diastolicBP}
                onChange={(e) => setFormData({ ...formData, diastolicBP: e.target.value })}
                className="w-full border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-medical-teal outline-none"
                placeholder="80"
              />
            </div>
            <div>
              <label className="block text-sm text-clinic-text/60 mb-1">
                SpO2 <span className="text-xs text-clinic-text/30">(%)</span>
              </label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={formData.spO2}
                onChange={(e) => setFormData({ ...formData, spO2: e.target.value })}
                className="w-full border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-medical-teal outline-none"
                placeholder="98"
              />
            </div>
            <div>
              <label className="block text-sm text-clinic-text/60 mb-1">
                Temperature <span className="text-xs text-clinic-text/30">(°C)</span>
              </label>
              <input
                type="number"
                step="0.1"
                min="30"
                max="45"
                value={formData.temperature}
                onChange={(e) => setFormData({ ...formData, temperature: e.target.value })}
                className="w-full border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-medical-teal outline-none"
                placeholder="36.5"
              />
            </div>
            <div>
              <label className="block text-sm text-clinic-text/60 mb-1">
                Respiratory Rate <span className="text-xs text-clinic-text/30">(12-20)</span>
              </label>
              <input
                type="number"
                min="0"
                max="60"
                value={formData.respiratoryRate}
                onChange={(e) => setFormData({ ...formData, respiratoryRate: e.target.value })}
                className="w-full border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-medical-teal outline-none"
                placeholder="16"
              />
            </div>
            <div className="col-span-2 md:col-span-3">
              <label className="block text-sm text-clinic-text/60 mb-1">Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-medical-teal outline-none resize-none"
                rows={2}
                placeholder="Optional notes..."
              />
            </div>
            <div className="col-span-2 md:col-span-3 flex gap-3">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="flex-1 bg-slate-100 text-clinic-text py-3 rounded-xl hover:bg-slate-200 transition font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 bg-hospital-navy text-white py-3 rounded-xl hover:bg-hospital-navy/90 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Saving...' : 'Save Vitals'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Current Vitals Card ───────────────────────────────────────── */}
      {latestVitals && (
        <div className="mb-6">
          <VitalsCard
            heartRate={latestVitals.heartRate}
            systolicBP={latestVitals.systolicBP}
            diastolicBP={latestVitals.diastolicBP}
            spO2={latestVitals.spO2}
            temperature={latestVitals.temperature}
            respiratoryRate={latestVitals.respiratoryRate}
            recordedAt={latestVitals.recordedAt}
            isCritical={latestVitals.isCritical}
          />
        </div>
      )}

      {/* ── No Vitals Message ─────────────────────────────────────────── */}
      {selectedPatient && vitals.length === 0 && !showForm && (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center mb-6">
          <Activity size={48} className="text-clinic-text/20 mx-auto mb-3" />
          <div className="text-clinic-text/50 font-medium">No vitals recorded for this patient</div>
          <button
            onClick={() => setShowForm(true)}
            className="mt-3 text-medical-teal hover:underline text-sm"
          >
            Record first vitals
          </button>
        </div>
      )}

      {/* ── Charts ────────────────────────────────────────────────────── */}
      {vitals.length > 1 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <VitalsChart
            history={vitals}
            vitalType="heartRate"
            color="#ef4444"
            label="Heart Rate (bpm)"
          />
          <VitalsChart
            history={vitals}
            vitalType="systolicBP"
            color="#3b82f6"
            label="Blood Pressure (mmHg)"
          />
          <VitalsChart
            history={vitals}
            vitalType="spO2"
            color="#06b6d4"
            label="SpO2 (%)"
          />
          <VitalsChart
            history={vitals}
            vitalType="temperature"
            color="#f97316"
            label="Temperature (°C)"
          />
        </div>
      )}
    </div>
  );
};
