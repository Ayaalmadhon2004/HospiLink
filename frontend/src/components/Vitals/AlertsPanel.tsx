// frontend/src/components/Vitals/AlertsPanel.tsx
import { AlertTriangle, Clock, User } from 'lucide-react';

interface Alert {
  id: string;
  patient: { name: string; patientCode: string; department: string };
  alertType: string;
  recordedAt: string;
  heartRate?: number;
  systolicBP?: number;
  spO2?: number;
}

interface AlertsPanelProps {
  alerts: Alert[];
}

const ALERT_LABELS: Record<string, string> = {
  HEART_RATE_HIGH: 'High Heart Rate',
  HEART_RATE_LOW: 'Low Heart Rate',
  BP_SYSTOLIC_HIGH: 'High Blood Pressure',
  BP_SYSTOLIC_LOW: 'Low Blood Pressure',
  BP_DIASTOLIC_HIGH: 'High Diastolic BP',
  BP_DIASTOLIC_LOW: 'Low Diastolic BP',
  SPO2_LOW: 'Low Oxygen Saturation',
  TEMPERATURE_HIGH: 'High Temperature',
  TEMPERATURE_LOW: 'Low Temperature',
  RESPIRATORY_RATE_HIGH: 'High Respiratory Rate',
  RESPIRATORY_RATE_LOW: 'Low Respiratory Rate',
};

const ALERT_COLORS: Record<string, string> = {
  HEART_RATE_HIGH: 'text-red-600',
  HEART_RATE_LOW: 'text-orange-600',
  BP_SYSTOLIC_HIGH: 'text-red-600',
  BP_SYSTOLIC_LOW: 'text-orange-600',
  SPO2_LOW: 'text-purple-600',
  TEMPERATURE_HIGH: 'text-red-600',
  TEMPERATURE_LOW: 'text-blue-600',
  default: 'text-red-600',
};

export const AlertsPanel = ({ alerts }: AlertsPanelProps) => {
  if (alerts.length === 0) {
    return (
      <div
        className="bg-green-50 border border-green-200 rounded-2xl p-6 text-center"
        role="status"
        aria-live="polite"
      >
        <div className="text-green-600 font-medium flex items-center justify-center gap-2">
          <span className="text-lg" aria-hidden="true">✅</span> All vitals normal
        </div>
        <div className="text-green-500/60 text-sm mt-1">No critical alerts at this time</div>
      </div>
    );
  }

  return (
    <section aria-label="Critical alerts" className="space-y-3">
      <h3 className="text-lg font-bold text-hospital-navy flex items-center gap-2">
        <AlertTriangle size={20} className="text-red-500" aria-hidden="true" />
        Critical Alerts
        <span
          className="bg-red-100 text-red-600 px-2 py-0.5 rounded-full text-sm"
          aria-label={`${alerts.length} critical alerts`}
        >
          {alerts.length}
        </span>
      </h3>

      <div className="grid gap-3" role="list" aria-label="Alert list">
        {alerts.map((alert) => (
          <article
            key={alert.id}
            className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start justify-between hover:bg-red-100/50 transition"
            role="listitem"
            aria-label={`${ALERT_LABELS[alert.alertType] || alert.alertType} for ${alert.patient.name}`}
          >
            <div className="flex-1">
              <div className={`font-bold ${ALERT_COLORS[alert.alertType] || ALERT_COLORS.default}`}>
                {ALERT_LABELS[alert.alertType] || alert.alertType}
              </div>

              <div className="flex items-center gap-2 text-sm text-clinic-text/70 mt-1">
                <User size={14} aria-hidden="true" />
                <span>{alert.patient.name}</span>
                <span className="text-clinic-text/40" aria-hidden="true">•</span>
                <span className="font-mono text-xs">{alert.patient.patientCode}</span>
                <span className="text-clinic-text/40" aria-hidden="true">•</span>
                <span>{alert.patient.department}</span>
              </div>

              <div className="flex gap-4 mt-2 text-xs" role="group" aria-label="Vital readings">
                {alert.heartRate !== undefined && alert.heartRate !== null && (
                  <span className="bg-white/60 px-2 py-1 rounded-md">
                    HR: <span className="font-bold text-red-600">{alert.heartRate}</span> bpm
                  </span>
                )}
                {alert.systolicBP !== undefined && alert.systolicBP !== null && (
                  <span className="bg-white/60 px-2 py-1 rounded-md">
                    BP: <span className="font-bold text-red-600">{alert.systolicBP}</span> mmHg
                  </span>
                )}
                {alert.spO2 !== undefined && alert.spO2 !== null && (
                  <span className="bg-white/60 px-2 py-1 rounded-md">
                    SpO₂: <span className="font-bold text-red-600">{alert.spO2}</span>%
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1 text-xs text-red-400 whitespace-nowrap">
              <Clock size={14} aria-hidden="true" />
              <time dateTime={alert.recordedAt}>
                {new Date(alert.recordedAt).toLocaleTimeString()}
              </time>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
};