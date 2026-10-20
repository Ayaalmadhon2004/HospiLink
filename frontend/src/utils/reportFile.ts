// Must match the multer limit in backend/src/middlewares/upload.middleware.ts (5 MB).
export const MAX_REPORT_FILE_MB = 5;
export const MAX_REPORT_FILE_BYTES = MAX_REPORT_FILE_MB * 1024 * 1024;

export const isReportFileTooLarge = (sizeBytes: number): boolean => sizeBytes > MAX_REPORT_FILE_BYTES;
