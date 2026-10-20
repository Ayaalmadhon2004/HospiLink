import { describe, expect, it } from 'vitest';
import { extractList, getErrorMessage, getResponseData } from './api';

describe('extractList', () => {
  it('unwraps { data: T[] }', () => {
    expect(extractList({ data: [1, 2] })).toEqual([1, 2]);
  });

  it('unwraps { data: { data: T[] } }', () => {
    expect(extractList({ data: { data: [3] } })).toEqual([3]);
  });

  it('returns [] for null, missing or non-array payloads', () => {
    expect(extractList(null)).toEqual([]);
    expect(extractList(undefined)).toEqual([]);
    expect(extractList({})).toEqual([]);
    expect(extractList({ data: { total: 1 } })).toEqual([]);
  });
});

describe('getErrorMessage', () => {
  it('reads Error, string and message-bearing objects', () => {
    expect(getErrorMessage(new Error('bad'))).toBe('bad');
    expect(getErrorMessage('plain')).toBe('plain');
    expect(getErrorMessage({ message: 'obj' })).toBe('obj');
  });

  it('falls back for empty or unknown values', () => {
    expect(getErrorMessage(new Error(''))).toBe('Something went wrong');
    expect(getErrorMessage(null, 'custom')).toBe('custom');
    expect(getErrorMessage({ message: 42 })).toBe('Something went wrong');
  });
});

describe('getResponseData', () => {
  it('returns the response body of an axios-style error', () => {
    expect(getResponseData({ response: { data: { message: 'm' } } })).toEqual({ message: 'm' });
  });

  it('returns undefined when there is no response', () => {
    expect(getResponseData(new Error('x'))).toBeUndefined();
    expect(getResponseData(null)).toBeUndefined();
  });
});
