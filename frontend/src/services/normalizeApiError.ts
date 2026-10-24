import { isAxiosError } from 'axios';
import i18n from '../i18n';
import { ApiError } from './apiError';

/** What the API sends on failure: `{ success:false, error:{ code, message, details? } }` (older routes: flat `code` / `message` / string `error`). */
interface ApiErrorBody {
  code?: string;
  message?: string;
  error?: string | { code?: string; message?: string; details?: unknown };
}

// 403 answers that the login page reacts to: keep the server's own reason instead of the generic "forbidden".
const ACCOUNT_CODES = new Set(['ACCOUNT_PENDING', 'ACCOUNT_DISABLED', 'EMAIL_NOT_VERIFIED']);

const HTTP_SERVER_ERROR = 500;
const HTTP_FORBIDDEN = 403;

/** Turns anything thrown by axios into an ApiError. */
export const toApiError = (error: unknown): ApiError => {
  if (error instanceof ApiError) return error;
  if (!isAxiosError<ApiErrorBody>(error)) {
    return new ApiError(error instanceof Error ? error.message : String(error));
  }

  const status = error.response?.status;
  const body = error.response?.data;
  const nested = typeof body?.error === 'object' && body.error !== null ? body.error : undefined;
  const code = nested?.code ?? body?.code;
  const serverMessage = nested?.message ?? body?.message ?? (typeof body?.error === 'string' ? body.error : undefined);

  // Codes with a locale entry are translated; the rest keep the server's message (validation details...).
  const translated = code && i18n.exists(`errors.codes.${code}`) ? i18n.t(`errors.codes.${code}`) : undefined;

  if (status === HTTP_FORBIDDEN) {
    const keep = code !== undefined && ACCOUNT_CODES.has(code);
    return new ApiError(keep ? translated || serverMessage || '' : i18n.t('errors.forbidden'), { code, status });
  }
  if (status !== undefined && status >= HTTP_SERVER_ERROR) {
    return new ApiError(i18n.t('errors.server'), { code, status });
  }
  return new ApiError(translated || serverMessage || error.message, { code, status });
};
