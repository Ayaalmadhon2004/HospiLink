import { describe, expect, it } from 'vitest';
import { toQueryString } from './api';

describe('toQueryString', () => {
  it('returns an empty string without params', () => {
    expect(toQueryString()).toBe('');
    expect(toQueryString({})).toBe('');
  });

  it('skips undefined, null and empty values', () => {
    expect(toQueryString({ status: undefined, department: '', search: null, page: '1' })).toBe('?page=1');
  });

  it('never sends the text "undefined"', () => {
    expect(toQueryString({ status: undefined, limit: 10 })).toBe('?limit=10');
  });

  it('encodes values and keeps booleans and numbers', () => {
    expect(toQueryString({ search: 'a b&c', active: false, n: 0 })).toBe('?search=a+b%26c&active=false&n=0');
  });
});
