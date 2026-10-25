/**
 * Integration tests: real PostgreSQL, real Prisma, real routers/controllers/triggers/constraints (nothing mocked).
 * Run with `npm run test:int` and INT_DATABASE_URL pointing at a THROWAWAY database whose name contains "test" or "e2e".
 * The unit suite (jest.config.js, `npm test`) is unchanged and needs no database.
 */
/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: __dirname,
  roots: ['<rootDir>/tests-int'],
  testMatch: ['**/*.int.test.ts'],
  globalSetup: '<rootDir>/tests-int/setup/globalSetup.js',
  setupFiles: ['<rootDir>/tests-int/setup/env.ts'],
  transform: { '^.+\\.tsx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json', diagnostics: false }] },
  transformIgnorePatterns: ['/node_modules/(?!(zod)/)'],
  cache: false,
  maxWorkers: 1, // one shared database: files run one after another
  testTimeout: 30000,
};
