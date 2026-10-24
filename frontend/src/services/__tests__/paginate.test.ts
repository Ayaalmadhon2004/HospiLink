import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiGet } from '../api';
import { apiGetAll } from '../paginate';

vi.mock('../api', () => ({ apiGet: vi.fn() }));

const pagination = (page: number, hasNextPage: boolean) =>
  ({ page, limit: 200, totalCount: 3, totalPages: 2, hasNextPage, hasPrevPage: page > 1 });

describe('apiGetAll', () => {
  beforeEach(() => vi.mocked(apiGet).mockReset());

  it('walks every page and concatenates the rows', async () => {
    vi.mocked(apiGet)
      .mockResolvedValueOnce({ success: true, data: [1, 2], pagination: pagination(1, true) })
      .mockResolvedValueOnce({ success: true, data: [3], pagination: pagination(2, false) });

    const res = await apiGetAll<number>('/beds', { department: 'ICU' });

    expect(res.data).toEqual([1, 2, 3]);
    expect(apiGet).toHaveBeenNthCalledWith(1, '/beds', { department: 'ICU', page: 1, limit: 200 });
    expect(apiGet).toHaveBeenNthCalledWith(2, '/beds', { department: 'ICU', page: 2, limit: 200 });
  });

  it('treats a response without pagination as a single page', async () => {
    vi.mocked(apiGet).mockResolvedValueOnce({ success: true, data: [1] });
    expect((await apiGetAll<number>('/x')).data).toEqual([1]);
    expect(apiGet).toHaveBeenCalledTimes(1);
  });
});
