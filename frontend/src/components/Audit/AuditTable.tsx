// components/Audit/AuditTable.tsx
import { useTranslation } from 'react-i18next';
import type { AuditLogEntry } from '../../services/auditLogService';

export const AuditTable = ({ items }: { items: AuditLogEntry[] }) => {
  const { t, i18n } = useTranslation();
  const fmt = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeStyle: 'medium' });

  if (items.length === 0) return <p className="text-sm text-gray-500 py-8 text-center">{t('audit.empty')}</p>;

  return (
    <div className="overflow-x-auto bg-white rounded-xl shadow-sm border border-slate-200">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50 text-gray-600">
          <tr>
            {(['time', 'user', 'action', 'entity', 'details'] as const).map((c) => (
              <th key={c} scope="col" className="px-4 py-3 text-start font-medium">{t(`audit.cols.${c}`)}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {items.map((row) => (
            <tr key={row.id} className="align-top">
              <td className="px-4 py-3 whitespace-nowrap text-gray-700">{fmt.format(new Date(row.createdAt))}</td>
              <td className="px-4 py-3">
                {row.user ? (
                  <>
                    <div className="font-medium text-gray-900">{row.user.name}</div>
                    <div className="text-xs text-gray-500">{row.user.role}</div>
                  </>
                ) : (
                  <span className="text-gray-400">{t('audit.deletedUser')}</span>
                )}
              </td>
              <td className="px-4 py-3"><code className="text-xs bg-slate-100 rounded px-1.5 py-0.5">{row.action}</code></td>
              <td className="px-4 py-3 font-mono text-xs text-gray-600 break-all">{row.entityId}</td>
              <td className="px-4 py-3 text-gray-600 break-words max-w-md">{row.details}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
