// frontend/src/services/paginate.ts
import { apiGet } from './api';
import type { ApiResponse, Pagination, QueryParams } from '../types/api';

const PAGE_SIZE = 200; // backend maximum
const MAX_PAGES = 50;

/**
 * Fetches every page of a paginated list endpoint (beds, staff, shifts...) for screens that need the
 * whole collection. Stops when the server reports no next page (an endpoint without `pagination` is one page).
 */
export const apiGetAll = async <T>(url: string, params?: QueryParams): Promise<ApiResponse<T[]>> => {
  const items: T[] = [];
  let last: ApiResponse<T[]> = { success: true, data: items };
  for (let page = 1; page <= MAX_PAGES; page++) {
    const res = await apiGet<ApiResponse<T[]> & { pagination?: Pagination }>(url, { ...params, page, limit: PAGE_SIZE });
    items.push(...(Array.isArray(res.data) ? res.data : []));
    last = res;
    if (!res.pagination?.hasNextPage) break;
  }
  return { ...last, data: items };
};
