import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
    // No `eslint-disable` comments anywhere: a rule that gets in the way is fixed in the code (or changed here, in review).
    linterOptions: { noInlineConfig: true },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/ban-ts-comment': 'error',
      // Log through utils/logger (dev-only), never console directly.
      'no-console': 'error',
    },
  },
  {
    // The logger is the single place allowed to touch console.
    files: ['src/utils/logger.ts'],
    rules: { 'no-console': 'off' },
  },
])
