import { ApiError } from '../services/apiError';

/** Standard envelope returned by the backend. */
export interface ApiResponse<T = unknown> {
  success?: boolean;
  data: T;
  message?: string;
  error?: string;
  user?: unknown;
  count?: number;
  total?: number;
}

/** Query-string parameters accepted by the list endpoints. */
export type QueryParams = Record<string, string | number | boolean | undefined>;

/** Build "?a=1&b=2", skipping undefined/null/empty values (URLSearchParams would send the text "undefined"). */
export const toQueryString = (params?: Record<string, string | number | boolean | null | undefined>): string => {
  if (!params) return '';
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    qs.append(key, String(value));
  }
  const out = qs.toString();
  return out ? `?${out}` : '';
};

/** Extract a human readable message from anything thrown/caught. */
export const getErrorMessage = (err: unknown, fallback = 'Something went wrong'): string => {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === 'string' && err) return err;
  if (typeof err === 'object' && err !== null) {
    const { message } = err as { message?: unknown };
    if (typeof message === 'string' && message) return message;
  }
  return fallback;
};

/** Machine-readable reason (`EMAIL_NOT_VERIFIED`, `CONFLICT`...) of an error rejected by the API layer, if it has one. */
export const getErrorCode = (err: unknown): string | undefined => {
  if (typeof err !== 'object' || err === null) return undefined;
  const { code } = err as { code?: unknown };
  return typeof code === 'string' ? code : undefined;
};

export interface Pagination {
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
  hasNextPage?: boolean;
  hasPrevPage?: boolean;
}

/** Endpoints disagree on `{ data: T[] }` vs `{ data: { data: T[] } }`; unwrap either into a list. */
export const extractList = <T>(res: unknown): T[] => {
  const outer = (res as { data?: unknown } | null | undefined)?.data;
  const inner = (outer as { data?: unknown } | null | undefined)?.data;
  const list = inner || outer || [];
  return Array.isArray(list) ? (list as T[]) : [];
};

export interface ApiErrorBody {
  message?: string;
  error?: string;
  fullError?: string;
}

/**
 * Body of the HTTP error response attached to a caught (axios-style) error, if any. An ApiError (what the API layer
 * rejects with) already carries the ready-to-show message, so that is returned as `message`.
 */
export const getResponseData = (err: unknown): ApiErrorBody | undefined =>
  err instanceof ApiError
    ? { message: err.message }
    : (err as { response?: { data?: ApiErrorBody } } | null | undefined)?.response?.data;
