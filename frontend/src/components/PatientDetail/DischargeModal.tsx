import { useTranslation, Trans } from 'react-i18next';

interface Props {
  patientName: string;
  error: string;
  discharging: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export const DischargeModal = ({ patientName, error, discharging, onCancel, onConfirm }: Props) => {
  const { t } = useTranslation();
  return (
    <div
      className="fixed inset-0 bg-hospital-navy/50 flex items-center justify-center z-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="discharge-title"
    >
      <div className="bg-white p-6 rounded-2xl w-full max-w-md shadow-xl">
        <h2 id="discharge-title" className="text-xl font-bold text-hospital-navy mb-2">{t('patientDetail.confirmDischarge')}</h2>
        <p className="text-clinic-text/50 mb-6">
          <Trans
            i18nKey="patientDetail.dischargeQuestion"
            values={{ name: patientName }}
            components={{ strong: <strong className="text-clinic-text" /> }}
          />
        </p>
        {error && (
          <div className="bg-red-50 text-red-600 px-4 py-3 rounded-xl mb-4 text-sm" role="alert">{error}</div>
        )}
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="bg-slate-100 text-clinic-text px-4 py-2 rounded-xl hover:bg-slate-200 transition"
            disabled={discharging}
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={onConfirm}
            className="bg-red-600 text-white px-4 py-2 rounded-xl hover:bg-red-700 transition disabled:opacity-50"
            disabled={discharging}
            aria-busy={discharging}
          >
            {discharging ? t('patientDetail.discharging') : t('patientDetail.confirmDischarge')}
          </button>
        </div>
      </div>
    </div>
  );
};
