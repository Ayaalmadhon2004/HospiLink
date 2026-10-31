import { useTranslation } from 'react-i18next';
import { Pencil, Trash2 } from 'lucide-react';
import { enumLabel } from '../../utils/enumLabel';
import type { StaffMember } from './staffMember';

interface Props {
  staff: StaffMember[];
  canManage: boolean;
  onEdit: (member: StaffMember) => void;
  onDelete: (id: string, name: string) => void;
}

export const StaffTable = ({ staff: filteredStaff, canManage, onEdit, onDelete }: Props) => {
  const { t } = useTranslation();
  return (
    <div className="bg-white rounded-xl shadow-sm border overflow-hidden hidden md:block" data-testid="staff-table">
      <table className="w-full">
        <thead className="bg-gray-50 border-b">
          <tr>
            <th scope="col" className="text-start text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">{t('staff.columns.name')}</th>
            <th scope="col" className="text-start text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">{t('staff.columns.role')}</th>
            <th scope="col" className="text-start text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">{t('staff.columns.department')}</th>
            <th scope="col" className="text-start text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">{t('staff.columns.status')}</th>
            <th scope="col" className="text-start text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">{t('staff.columns.currentShift')}</th>
            <th scope="col" className="text-end text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">{t('staff.columns.actions')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {filteredStaff.map((member) => (
            <tr key={member.id} className="hover:bg-gray-50 transition group">
              <td className="px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center text-teal-600 font-bold">
                    {member.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">{member.name}</div>
                    <div className="text-xs text-gray-500">{member.email}</div>
                    {member.hasLogin === false && (
                      <span
                        className="mt-1 inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800"
                        title={t('staff.noLoginHint')}
                      >
                        {t('staff.noLogin')}
                      </span>
                    )}
                  </div>
                </div>
              </td>
              <td className="px-6 py-4 text-gray-600">{t(`staff.roles.${member.role}`, { defaultValue: member.role })}</td>
              <td className="px-6 py-4 text-gray-600">{t(`departments.${member.department}`, { defaultValue: member.department })}</td>
              <td className="px-6 py-4">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${member.isActive ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-500'}`}>
                  {member.isActive ? t('staff.status.ACTIVE') : t('staff.status.INACTIVE')}
                </span>
              </td>
              <td className="px-6 py-4">
                {member.shifts?.[0] ? (
                  <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-600">
                    {enumLabel(t, 'shiftType', member.shifts[0].type)}
                  </span>
                ) : (
                  <span className="text-gray-500 text-sm">—</span>
                )}
              </td>
              <td className="px-6 py-4 text-end">
                {canManage && (
                  <div className="flex items-center justify-end gap-2 md:opacity-0 md:group-hover:opacity-100 focus-within:opacity-100 transition">
                    <button
                      onClick={() => onEdit(member)}
                      className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                      title={t('staff.edit')}
                      aria-label={t('staff.edit')}
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      onClick={() => onDelete(member.id, member.name)}
                      className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                      title={t('staff.delete')}
                      aria-label={t('staff.delete')}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
