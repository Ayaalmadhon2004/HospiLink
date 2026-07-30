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
      diagnostics: false,
      isolatedModules: true
    }]
  },
  transformIgnorePatterns: [
    '/node_modules/(?!(zod)/)'
  ],
  testPathIgnorePatterns: ['/node_modules/'],
  cache: false,
  maxWorkers: 1
};