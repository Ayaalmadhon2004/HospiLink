// pages/VitalsMonitorPage.tsx
import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Activity, Plus, RefreshCw, ChevronDown, AlertCircle, X } from 'lucide-react';
import { getVitals, getCriticalAlerts, recordVitals } from '../services/vitalsService';
import { getPatients } from '../services/patientService';
import { getErrorMessage } from '../types/api';
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

interface Toast {
  id: string;
  message: string;
  type: 'error' | 'success';
}

// ─── Helpers ───────────────────────────────────────────────────────────
const ensureArray = <T,>(value: unknown): T[] => {
  if (Array.isArray(value)) return value as T[];
  return [];
};

const mergeVitals = (existing: VitalRecord[], incoming: VitalRecord[]): VitalRecord[] => {
  const combined = [...existing, ...incoming];
  const seen = new Set<string>();
  return combined
    .filter((v) => {
      if (!v?.id) return false;
      if (seen.has(v.id)) return false;
      seen.add(v.id);
      return true;
    })
    .slice(0, 20);
};

// ─── Component ─────────────────────────────────────────────────────────

export const VitalsMonitorPage = () => {
  const { t } = useTranslation();
  // ── Core State ──────────────────────────────────────────────────────
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<string>('');
  const [vitals, setVitals] = useState<VitalRecord[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Toast notifications state
  const [toasts, setToasts] = useState<Toast[]>([]);

  // ✅ Refs لمنع الـ loops والـ parallel requests
  const isFetching = useRef(false);
  const isFetchingVitals = useRef(false);
  const lastSocketId = useRef<string | null>(null);
  const lastFetchTime = useRef<number>(0);
  const isInitialLoad = useRef(true);

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
  const { latestVital } = useVitalsSocket(selectedPatient || '');

  // ── Toast Helper ────────────────────────────────────────────────────
  const showToast = useCallback((message: string, type: 'error' | 'success') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((item) => item.id !== id));
    }, 5000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  // ── Fetch Patients + Alerts (مرة واحدة عند التحميل) ───────────────
  const fetchData = useCallback(
    async (showErrors = false) => {
      // ✅ منع parallel requests + throttle (ما يتنادى أكتر من مرة كل 5 ثواني)
      const now = Date.now();
      if (isFetching.current || now - lastFetchTime.current < 5000) return;

      isFetching.current = true;
      lastFetchTime.current = now;
      setRefreshing(true);

      try {
        // Fetch patients independently
        let patientsData: Patient[] = [];
        try {
          const patientsRes = await getPatients();
          patientsData = ensureArray<Patient>(patientsRes?.data ?? patientsRes);
        } catch {
          if (showErrors) showToast(t('vitals.page.patientsError'), 'error');
        }
        setPatients(patientsData);

        // Fetch alerts independently
        let alertsData: AlertItem[] = [];
        try {
          const alertsRes = await getCriticalAlerts();
          alertsData = ensureArray<AlertItem>(alertsRes?.data ?? alertsRes);
        } catch {
          // Alerts are optional; the panel simply stays empty
        }
        setAlerts(alertsData);
      } catch {
        if (showErrors) showToast(t('vitals.page.fetchError'), 'error');
      } finally {
        setRefreshing(false);
        setLoading(false);
        isInitialLoad.current = false;
        isFetching.current = false;
      }
    },
    [showToast, t]
  );

  // ── Fetch Historical Vitals ───────────────────────────────────────
  const fetchVitals = useCallback(
    async (patientId: string) => {
      if (!patientId) {
        setVitals([]);
        return;
      }

      // ✅ منع parallel requests
      if (isFetchingVitals.current) return;
      isFetchingVitals.current = true;

      setLoading(true);
      try {
        const res = await getVitals({ patientId, limit: 20 });
        const data = ensureArray<VitalRecord>(res?.data ?? res);
        setVitals((prev) => mergeVitals(ensureArray<VitalRecord>(prev), data));
      } catch {
        // Keep previously loaded vitals on failure
      } finally {
        setLoading(false);
        isFetchingVitals.current = false;
      }
    },
    []
  );

  // ✅ Initial load — مرة واحدة بس
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- effect intentionally syncs/fetches into state (data load or reset on prop change); restructuring would change behaviour
    fetchData(false);
  }, [fetchData]); // fetchData is stable (its only dependency, showToast, never changes)

  // ✅ Polling كل 30 ثانية — بس لو الصفحة visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) return;
      // لما ترجع للصفحة، تأكد إنه مر 30 ثانية على الأقل
      if (Date.now() - lastFetchTime.current > 30000) {
        fetchData(false);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    const interval = setInterval(() => {
      if (!document.hidden) {
        fetchData(false);
      }
    }, 30000);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchData]);

  // ✅ Fetch vitals لما يتغير المريض
  useEffect(() => {
    if (selectedPatient) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- effect intentionally syncs/fetches into state (data load or reset on prop change); restructuring would change behaviour
      fetchVitals(selectedPatient);
    } else {
      setVitals([]);
    }
  }, [selectedPatient, fetchVitals]);

  // ✅ Socket: add new vital — بتحقق إنه جديد فعلاً
  useEffect(() => {
    if (!latestVital || !selectedPatient) return;

    const vitalId = latestVital.id || JSON.stringify(latestVital);
    if (vitalId === lastSocketId.current) return; // ⬅️ نفس الـ vital القديم

    lastSocketId.current = vitalId;

    setVitals((prev) => {
      const safePrev = ensureArray<VitalRecord>(prev);
      const newVital: VitalRecord = latestVital;
      const exists = safePrev.some((v) => v?.id === newVital?.id);
      if (exists) return safePrev;
      return [newVital, ...safePrev].slice(0, 20);
    });
  }, [latestVital, selectedPatient]);

  // ── Handlers ────────────────────────────────────────────────────────

  const handleRefresh = () => {
    fetchData(true); // Show errors on manual refresh
  };

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

      if (res?.data) {
        setVitals((prev) => {
          const safePrev = ensureArray<VitalRecord>(prev);
          const newVital = res.data as VitalRecord;
          const exists = safePrev.some((v) => v?.id === newVital?.id);
          if (exists) return safePrev;
          return [newVital, ...safePrev].slice(0, 20);
        });
      }

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

      showToast(t('vitals.page.recorded'), 'success');
      await fetchData(false); // Refresh alerts silently
    } catch (err: unknown) {
      showToast(getErrorMessage(err, '') || t('vitals.page.recordError'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const latestVitals = vitals[0];

  // ── Render ──────────────────────────────────────────────────────────

  if (loading && patients.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-clinic-bg">
        <div className="animate-pulse text-clinic-text/50">{t('vitals.page.loading')}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-clinic-bg p-6 md:p-8">
      {/* Toast Notifications */}
      <div
        className="fixed top-4 end-4 z-50 space-y-2"
        role="region"
        aria-label={t('common.notifications')}
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg transition-all ${
              toast.type === 'error'
                ? 'bg-red-50 border border-red-200 text-red-700'
                : 'bg-green-50 border border-green-200 text-green-700'
            }`}
            role="alert"
            aria-live="polite"
          >
            <AlertCircle size={18} aria-hidden="true" />
            <span className="text-sm font-medium">{toast.message}</span>
            <button
              onClick={() => removeToast(toast.id)}
              className="ms-2 text-current opacity-50 hover:opacity-100"
              aria-label={t('dispatch.dismiss')}
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>

      {/* ── Header ────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-hospital-navy flex items-center gap-2">
            <Activity size={28} className="text-medical-teal" aria-hidden="true" />
            {t('vitals.page.title')}
          </h1>
          <p className="text-clinic-text/50 text-sm">{t('vitals.page.subtitle')}</p>
        </div>
        <button
          onClick={handleRefresh}
          className="flex items-center gap-2 bg-white text-clinic-text px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 transition shadow-sm"
          disabled={refreshing}
          aria-label={t('vitals.page.refreshLabel')}
        >
          <RefreshCw
            size={16}
            className={refreshing ? 'animate-spin' : ''}
            aria-hidden="true"
          />
          {t('staff.refresh')}
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
            <label htmlFor="patient-select" className="sr-only">
              {t('vitals.page.selectPatient')}
            </label>
            <select
              id="patient-select"
              value={selectedPatient}
              onChange={(e) => setSelectedPatient(e.target.value)}
              className="w-full appearance-none border border-slate-200 p-3 pe-10 rounded-xl focus:ring-2 focus:ring-medical-teal outline-none bg-white"
            >
              <option value="">{t('vitals.page.selectPatient')}</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} • {p.patientCode} • {t(`departments.${p.department}`, { defaultValue: p.department })}
                </option>
              ))}
            </select>
            <ChevronDown
              size={16}
              className="absolute end-3 top-1/2 -translate-y-1/2 text-clinic-text/40 pointer-events-none"
              aria-hidden="true"
            />
          </div>

          {selectedPatient && (
            <button
              onClick={() => setShowForm(!showForm)}
              className="bg-hospital-navy text-white px-6 py-3 rounded-xl hover:bg-hospital-navy/90 transition flex items-center justify-center gap-2 shadow-sm"
              aria-expanded={showForm}
              aria-controls="vitals-form"
            >
              <Plus size={18} aria-hidden="true" />
              {showForm ? t('vitals.page.hideForm') : t('vitals.page.recordVitals')}
            </button>
          )}
        </div>
      </div>

      {/* ── Record Form ───────────────────────────────────────────────── */}
      {showForm && selectedPatient && (
        <div
          id="vitals-form"
          className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6 animate-in fade-in slide-in-from-top-2 duration-200"
        >
          <h3 className="text-lg font-bold text-hospital-navy mb-4">{t('vitals.page.recordNew')}</h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <label htmlFor="heart-rate" className="block text-sm text-clinic-text/60 mb-1">
                {t('vitals.heartRate')} <span className="text-xs text-clinic-text/50">(60-100)</span>
              </label>
              <input
                id="heart-rate"
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
              <label htmlFor="systolic-bp" className="block text-sm text-clinic-text/60 mb-1">
                {t('vitals.page.systolic')} <span className="text-xs text-clinic-text/50">(90-140)</span>
              </label>
              <input
                id="systolic-bp"
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
              <label htmlFor="diastolic-bp" className="block text-sm text-clinic-text/60 mb-1">
                {t('vitals.page.diastolic')} <span className="text-xs text-clinic-text/50">(60-90)</span>
              </label>
              <input
                id="diastolic-bp"
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
              <label htmlFor="spo2" className="block text-sm text-clinic-text/60 mb-1">
                {t('vitals.spO2')} <span className="text-xs text-clinic-text/50">(%)</span>
              </label>
              <input
                id="spo2"
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
              <label htmlFor="temperature" className="block text-sm text-clinic-text/60 mb-1">
                {t('vitals.temperature')} <span className="text-xs text-clinic-text/50">(°C)</span>
              </label>
              <input
                id="temperature"
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
              <label htmlFor="respiratory-rate" className="block text-sm text-clinic-text/60 mb-1">
                {t('vitals.respiratoryRate')} <span className="text-xs text-clinic-text/50">(12-20)</span>
              </label>
              <input
                id="respiratory-rate"
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
              <label htmlFor="notes" className="block text-sm text-clinic-text/60 mb-1">
                {t('vitals.page.notes')}
              </label>
              <textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-medical-teal outline-none resize-none"
                rows={2}
                placeholder={t('vitals.page.notesPlaceholder')}
              />
            </div>
            <div className="col-span-2 md:col-span-3 flex gap-3">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="flex-1 bg-slate-100 text-clinic-text py-3 rounded-xl hover:bg-slate-200 transition font-medium"
              >
                {t('common.cancel')}
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 bg-hospital-navy text-white py-3 rounded-xl hover:bg-hospital-navy/90 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                aria-busy={submitting}
              >
                {submitting ? t('common.saving') : t('vitals.page.save')}
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
          <Activity size={48} className="text-clinic-text/20 mx-auto mb-3" aria-hidden="true" />
          <div className="text-clinic-text/50 font-medium">{t('vitals.page.empty')}</div>
          <button
            onClick={() => setShowForm(true)}
            className="mt-3 text-medical-teal hover:underline text-sm"
          >
            {t('vitals.page.recordFirst')}
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
            label={t('vitals.page.chartHeartRate')}
          />
          <VitalsChart
            history={vitals}
            vitalType="systolicBP"
            color="#3b82f6"
            label={t('vitals.page.chartBP')}
          />
          <VitalsChart history={vitals} vitalType="spO2" color="#06b6d4" label={t('vitals.page.chartSpO2')} />
          <VitalsChart
            history={vitals}
            vitalType="temperature"
            color="#f97316"
            label={t('vitals.page.chartTemperature')}
          />
        </div>
      )}
    </div>
  );
};