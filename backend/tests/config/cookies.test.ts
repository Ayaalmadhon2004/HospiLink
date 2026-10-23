import { authCookieOptions, clearCookieOptions } from '../../src/config/cookies';

describe('cookies config', () => {
  const env = { ...process.env };
  afterEach(() => {
    process.env = { ...env };
  });

  it('without COOKIE_DOMAIN keeps the legacy cross-site cookie (None + secure)', () => {
    delete process.env.COOKIE_DOMAIN;
    expect(authCookieOptions(1000)).toEqual({
      httpOnly: true, secure: true, sameSite: 'none', path: '/', maxAge: 1000,
    });
  });

  it('with COOKIE_DOMAIN uses Lax and the shared domain', () => {
    process.env.COOKIE_DOMAIN = '.hospilink.example';
    process.env.NODE_ENV = 'production';
    expect(authCookieOptions(1000)).toEqual({
      httpOnly: true, secure: true, sameSite: 'lax', path: '/', domain: '.hospilink.example', maxAge: 1000,
    });
  });

  it('Lax is not secure outside production (plain http localhost)', () => {
    process.env.COOKIE_DOMAIN = 'localhost';
    process.env.NODE_ENV = 'test';
    expect(authCookieOptions().secure).toBe(false);
  });

  it('omits maxAge for a session cookie', () => {
    expect(authCookieOptions()).not.toHaveProperty('maxAge');
  });

  it('clear options match the set options (minus maxAge)', () => {
    process.env.COOKIE_DOMAIN = '.hospilink.example';
    const { maxAge: _m, ...set } = authCookieOptions(1000);
    expect(clearCookieOptions()).toEqual(set);
  });
});
