import { loadEnv, parseOrigins } from '../../src/config/env';

const base = {
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
  JWT_SECRET: 'secret',
  CORS_ORIGINS: 'http://localhost:5173',
};

describe('parseOrigins', () => {
  it('trims, strips trailing slashes and de-duplicates', () => {
    expect(parseOrigins(' https://a.example.com/ , http://localhost:5173,,http://localhost:5173')).toEqual([
      'https://a.example.com',
      'http://localhost:5173',
    ]);
  });
});

describe('loadEnv', () => {
  it('parses a valid environment and applies the PORT/NODE_ENV defaults', () => {
    const env = loadEnv(base);
    expect(env.CORS_ORIGINS).toEqual(['http://localhost:5173']);
    expect(env.PORT).toBe(5000);
    expect(env.NODE_ENV).toBe('development');
  });

  it('coerces PORT from a string', () => {
    expect(loadEnv({ ...base, PORT: '8080' }).PORT).toBe(8080);
  });

  it.each([
    ['CORS_ORIGINS missing', { ...base, CORS_ORIGINS: undefined }],
    ['CORS_ORIGINS empty', { ...base, CORS_ORIGINS: ' , ' }],
    ['CORS_ORIGINS not a URL', { ...base, CORS_ORIGINS: 'localhost:5173' }],
    ['DATABASE_URL missing', { ...base, DATABASE_URL: undefined }],
    ['PORT out of range', { ...base, PORT: '70000' }],
  ])('throws when %s', (_label, source) => {
    expect(() => loadEnv(source as NodeJS.ProcessEnv)).toThrow(/Invalid environment configuration/);
  });
});
