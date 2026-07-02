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
      <div className="bg-green-50 border border-green-200 rounded-2xl p-6 text-center">
        <div className="text-green-600 font-medium flex items-center justify-center gap-2">
          <span className="text-lg">✅</span> All vitals normal
        </div>
        <div className="text-green-500/60 text-sm mt-1">No critical alerts at this time</div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-bold text-hospital-navy flex items-center gap-2">
        <AlertTriangle size={20} className="text-red-500" />
        Critical Alerts 
        <span className="bg-red-100 text-red-600 px-2 py-0.5 rounded-full text-sm">
          {alerts.length}
        </span>
      </h3>
      
      <div className="grid gap-3">
        {alerts.map((alert) => (
          <div
            key={alert.id}
            className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start justify-between hover:bg-red-100/50 transition"
          >
            <div className="flex-1">
              <div className={`font-bold ${ALERT_COLORS[alert.alertType] || ALERT_COLORS.default}`}>
                {ALERT_LABELS[alert.alertType] || alert.alertType}
              </div>
              
              <div className="flex items-center gap-2 text-sm text-clinic-text/70 mt-1">
                <User size={14} />
                <span>{alert.patient.name}</span>
                <span className="text-clinic-text/40">•</span>
                <span className="font-mono text-xs">{alert.patient.patientCode}</span>
                <span className="text-clinic-text/40">•</span>
                <span>{alert.patient.department}</span>
              </div>
              
              <div className="flex gap-4 mt-2 text-xs">
                {alert.heartRate && (
                  <span className="bg-white/60 px-2 py-1 rounded-md">
                    HR: <span className="font-bold text-red-600">{alert.heartRate}</span> bpm
                  </span>
                )}
                {alert.systolicBP && (
                  <span className="bg-white/60 px-2 py-1 rounded-md">
                    BP: <span className="font-bold text-red-600">{alert.systolicBP}</span> mmHg
                  </span>
                )}
                {alert.spO2 && (
                  <span className="bg-white/60 px-2 py-1 rounded-md">
                    SpO2: <span className="font-bold text-red-600">{alert.spO2}</span>%
                  </span>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-1 text-xs text-red-400 whitespace-nowrap">
              <Clock size={14} />
              {new Date(alert.recordedAt).toLocaleTimeString()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};