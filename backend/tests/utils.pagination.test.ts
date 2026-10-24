import { pageParams, pageInfo } from '../src/utils/pagination';

describe('pageParams', () => {
  it('defaults to page 1 / limit 100', () => {
    expect(pageParams({})).toEqual({ page: 1, limit: 100, skip: 0, take: 100 });
    expect(pageParams(undefined, 20)).toEqual({ page: 1, limit: 20, skip: 0, take: 20 });
  });

  it('parses strings and numbers, clamps limit to 200', () => {
    expect(pageParams({ page: '2', limit: '25' })).toEqual({ page: 2, limit: 25, skip: 25, take: 25 });
    expect(pageParams({ page: 3, limit: 999 })).toEqual({ page: 3, limit: 200, skip: 400, take: 200 });
  });

  it.each(['0', '-1', 'abc', '1.5', '', null, {}])('falls back to defaults for %p', (bad) => {
    expect(pageParams({ page: bad, limit: bad })).toEqual({ page: 1, limit: 100, skip: 0, take: 100 });
  });
});

describe('pageInfo', () => {
  it('computes totals and navigation flags', () => {
    expect(pageInfo({ page: 2, limit: 10 }, 25)).toEqual({
      page: 2, limit: 10, totalCount: 25, totalPages: 3, hasNextPage: true, hasPrevPage: true,
    });
    expect(pageInfo({ page: 1, limit: 10 }, 0)).toMatchObject({ totalPages: 0, hasNextPage: false, hasPrevPage: false });
  });
});
