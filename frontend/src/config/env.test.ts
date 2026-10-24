import { describe, it, expect } from 'vitest';
import { API_URL, SOCKET_URL } from './env';

describe('env', () => {
  it('reads VITE_API_URL and derives the socket host without /api', () => {
    expect(API_URL).toBe('http://localhost:5000/api');
    expect(SOCKET_URL).toBe('http://localhost:5000');
  });
});
