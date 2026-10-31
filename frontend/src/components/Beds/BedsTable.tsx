import { useTranslation } from 'react-i18next';
import { BedDouble, MoreHorizontal, Trash2 } from 'lucide-react';
import type { BedWithDetails } from '../../types/bed';
import { getBedStatusConfig } from './bedStatusConfig';

interface Props {
  beds: BedWithDetails[];
  onEdit: (bed: BedWithDetails) => void;
  onDelete: (id: string, name: string) => void;
}

export const BedsTable = ({ beds: filteredBeds, onEdit, onDelete }: Props) => {
  const { t } = useTranslation();
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <table className="w-full">
        <thead className="bg-gray-50 border-b">
          <tr>
            <th className="text-start text-xs font-semibold text-gray-500 uppercase px-6 py-4">{t('beds.columns.bed')}</th>
            <th className="text-start text-xs font-semibold text-gray-500 uppercase px-6 py-4">{t('beds.columns.ward')}</th>
            <th className="text-start text-xs font-semibold text-gray-500 uppercase px-6 py-4">{t('beds.columns.status')}</th>
            <th className="text-start text-xs font-semibold text-gray-500 uppercase px-6 py-4">{t('beds.columns.patient')}</th>
            <th className="text-end text-xs font-semibold text-gray-500 uppercase px-6 py-4">{t('beds.columns.actions')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {filteredBeds.map((bed) => {
            const config = getBedStatusConfig(t, bed.status);
            return (
              <tr key={bed.id} className="hover:bg-gray-50 transition">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                      <BedDouble className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{t('beds.bedLabel', { number: bed.bedNumber })}</p>
                      <p className="text-xs text-gray-500">{t('beds.idLabel', { id: bed.id.slice(0, 8) })}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-gray-700">{bed.ward.name}</td>
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${config.badge}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`}></span>
                    {config.label}
                  </span>
                </td>
                <td className="px-6 py-4">
                  {bed.patient ? (
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-xs font-bold">
                        {bed.patient.name.charAt(0)}
                      </div>
                      <span className="text-sm text-gray-700">{bed.patient.name}</span>
                    </div>
                  ) : (
                    <span className="text-sm text-gray-400">—</span>
                  )}
                </td>
                <td className="px-6 py-4 text-end">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => onEdit(bed)}
                      aria-label={t('beds.editLabel', { number: bed.bedNumber })}
                      className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onDelete(bed.id, t('beds.bedLabel', { number: bed.bedNumber }))}
                      aria-label={t('beds.deleteLabel', { number: bed.bedNumber })}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {filteredBeds.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <BedDouble className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>{t('beds.empty')}</p>
        </div>
      )}
    </div>
  );
};
