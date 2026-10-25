// backend/src/services/exports/types.ts
export const EXPORT_TYPES = ['patients', 'appointments', 'vitals', 'billing'] as const;
export type ExportType = (typeof EXPORT_TYPES)[number];
export const EXPORT_FORMATS = ['xlsx', 'pdf'] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

/** How a cell is written: `money` rows hold MINOR units and are shown in major units (2 decimals). */
export type ColumnKind = 'text' | 'number' | 'money' | 'datetime' | 'bool';

export interface ExportColumn {
  key: string;
  header: string;
  kind: ColumnKind;
  /** Relative width, used by both writers. */
  width: number;
}

export type CellValue = string | number | boolean | Date | null;
export type ExportRow = Record<string, CellValue>;

export interface DateRange {
  from: Date;
  /** Exclusive. */
  to: Date;
}

export interface ExportDataset {
  title: string;
  columns: ExportColumn[];
  rows: ExportRow[];
}
