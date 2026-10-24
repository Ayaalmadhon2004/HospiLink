// backend/src/utils/pagination.ts
//
// Shared page/limit handling for list endpoints. Same response block as GET /patients:
// `pagination: { page, limit, totalCount, totalPages, hasNextPage, hasPrevPage }`.
// Query values are parsed leniently (non-numbers fall back to the defaults, limit is clamped),
// so controllers behave the same with or without the zod query schema in front of them.
export const DEFAULT_PAGE_LIMIT = 100;
export const MAX_PAGE_LIMIT = 200;

export interface PageParams {
  page: number;
  limit: number;
  skip: number;
  take: number;
}

const positiveInt = (raw: unknown): number | undefined => {
  if (typeof raw !== 'string' && typeof raw !== 'number') return undefined;
  const n = Number(String(raw).trim());
  return Number.isSafeInteger(n) && n > 0 ? n : undefined;
};

export const pageParams = (
  query: { page?: unknown; limit?: unknown } | undefined,
  defaultLimit = DEFAULT_PAGE_LIMIT
): PageParams => {
  const page = positiveInt(query?.page) ?? 1;
  const limit = Math.min(positiveInt(query?.limit) ?? defaultLimit, MAX_PAGE_LIMIT);
  return { page, limit, skip: (page - 1) * limit, take: limit };
};

export const pageInfo = (p: Pick<PageParams, 'page' | 'limit'>, totalCount: number) => {
  const totalPages = Math.ceil(totalCount / p.limit);
  return {
    page: p.page,
    limit: p.limit,
    totalCount,
    totalPages,
    hasNextPage: p.page < totalPages,
    hasPrevPage: p.page > 1,
  };
};
