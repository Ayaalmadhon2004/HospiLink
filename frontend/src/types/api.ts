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

/** Body of the HTTP error response attached to a caught (axios-style) error, if any. */
export const getResponseData = (err: unknown): ApiErrorBody | undefined =>
  (err as { response?: { data?: ApiErrorBody } } | null | undefined)?.response?.data;
