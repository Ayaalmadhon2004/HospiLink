// services/exportService.ts
import { api } from './api';

export type ExportType = 'patients' | 'appointments' | 'vitals' | 'billing';
export type ExportFormat = 'xlsx' | 'pdf';

export interface ExportRange {
  /** ISO instants; `to` is exclusive. Omit both for the server default (last 30 days). */
  from?: string;
  to?: string;
}

/** Same name the server suggests; built here because Content-Disposition is not exposed to cross-origin scripts. */
export const exportFileName = (type: ExportType, format: ExportFormat, now = new Date()): string =>
  `hospilink-${type}-${now.toISOString().slice(0, 10)}.${format}`;

/** Fetches the export (auth cookie, blob) and hands it to the browser as a download. Rejects with an ApiError (status 413 = too many rows). */
export const downloadExport = async (type: ExportType, format: ExportFormat, range: ExportRange): Promise<void> => {
  const res = await api.get<Blob>(`/exports/${type}`, { params: { format, ...range }, responseType: 'blob', timeout: 120_000 });
  const url = URL.createObjectURL(res.data);
  const link = document.createElement('a');
  link.href = url;
  link.download = exportFileName(type, format);
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
};
