/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/tests/setup.ts'],
  testMatch: ['**/*.test.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: '<rootDir>/tsconfig.json',
      diagnostics: false
    }]
  },
  transformIgnorePatterns: [
    '/node_modules/(?!(zod)/)'
  ],
  testPathIgnorePatterns: ['/node_modules/', '/tests-int/'], // integration tests need a real database: npm run test:int
  cache: false,
  maxWorkers: 1
};