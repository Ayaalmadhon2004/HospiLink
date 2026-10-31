import { useTranslation } from 'react-i18next';
import { User, Bed, Stethoscope, Activity } from 'lucide-react';
import type { PatientDetail } from '../../types/patient';
import { formatDate } from '../../utils/datetime';
import { enumLabel } from '../../utils/enumLabel';

export const PatientInfoGrid = ({ patient }: { patient: PatientDetail }) => {
  const { t } = useTranslation();
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
      {/* Personal Info */}
      <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <h2 className="text-lg font-bold text-hospital-navy mb-4 flex items-center gap-2">
          <User size={20} className="text-medical-teal" aria-hidden="true" />
          {t('patientDetail.personalInfo')}
        </h2>
        <dl className="space-y-3">
          <div className="flex justify-between">
            <dt className="text-clinic-text/50">{t('patientDetail.age')}</dt>
            <dd className="font-medium text-clinic-text">{t('patientDetail.years', { count: patient.age })}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-clinic-text/50">{t('patientDetail.gender')}</dt>
            <dd className="font-medium text-clinic-text">{enumLabel(t, 'gender', patient.gender)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-clinic-text/50">{t('patientDetail.admissionDate')}</dt>
            <dd className="font-medium text-clinic-text">
              <time dateTime={patient.admissionDate}>
                {formatDate(patient.admissionDate)}
              </time>
            </dd>
          </div>
          {patient.dischargeDate && (
            <div className="flex justify-between">
              <dt className="text-clinic-text/50">{t('patientDetail.dischargeDate')}</dt>
              <dd className="font-medium text-medical-teal">
                <time dateTime={patient.dischargeDate}>
                  {formatDate(patient.dischargeDate)}
                </time>
              </dd>
            </div>
          )}
        </dl>
      </section>

      {/* Medical Info */}
      <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <h2 className="text-lg font-bold text-hospital-navy mb-4 flex items-center gap-2">
          <Stethoscope size={20} className="text-red-500" aria-hidden="true" />
          {t('patientDetail.medicalInfo')}
        </h2>
        <dl className="space-y-3">
          <div className="flex justify-between">
            <dt className="text-clinic-text/50">{t('patientDetail.department')}</dt>
            <dd className="font-medium text-clinic-text">{t(`departments.${patient.department}`, { defaultValue: patient.department })}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-clinic-text/50">{t('patientDetail.diagnosis')}</dt>
            <dd className="font-medium text-clinic-text">{patient.diagnosis}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-clinic-text/50">{t('patientDetail.attendingPhysician')}</dt>
            <dd className="font-medium text-clinic-text">{patient.doctor?.name || t('patientDetail.notAssigned')}</dd>
          </div>
        </dl>
      </section>

      {/* Bed Info */}
      <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <h2 className="text-lg font-bold text-hospital-navy mb-4 flex items-center gap-2">
          <Bed size={20} className="text-medical-teal" aria-hidden="true" />
          {t('patientDetail.bedInfo')}
        </h2>
        {patient.bed ? (
          <dl className="space-y-3">
            <div className="flex justify-between">
              <dt className="text-clinic-text/50">{t('patientDetail.bedNumber')}</dt>
              <dd className="font-medium text-clinic-text">{patient.bed.bedNumber}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-clinic-text/50">{t('patientDetail.ward')}</dt>
              <dd className="font-medium text-clinic-text">{patient.bed.wardName}</dd>
            </div>
          </dl>
        ) : (
          <p className="text-clinic-text/40">{t('patientDetail.noBed')}</p>
        )}
      </section>

      {/* Vitals */}
      <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <h2 className="text-lg font-bold text-hospital-navy mb-4 flex items-center gap-2">
          <Activity size={20} className="text-purple-500" aria-hidden="true" />
          {t('patientDetail.vitals')}
        </h2>
        <p className="text-clinic-text/40 text-sm">{t('patientDetail.vitalsSoon')}</p>
      </section>
    </div>
  );
};
