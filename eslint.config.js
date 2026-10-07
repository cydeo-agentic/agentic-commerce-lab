import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import playwright from 'eslint-plugin-playwright';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['node_modules/', 'playwright-report/', 'test-results/', 'artifacts/', 'store/data/', '.playwright-mcp/'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ...playwright.configs['flat/recommended'],
    files: ['tests/**/*.ts'],
    rules: {
      ...playwright.configs['flat/recommended'].rules,
      // The gates this program teaches: no fixed sleeps, no focused or skipped-by-accident tests.
      'playwright/no-wait-for-timeout': 'error',
      'playwright/no-focused-test': 'error',
      'playwright/no-networkidle': 'error',
      // A skip is allowed only with a condition and a reason (e.g. a missing secret), never blanket.
      'playwright/no-skipped-test': ['error', { allowConditional: true }],
    },
  },
  {
    files: ['scripts/**/*.mjs', 'store/**/*.mjs'],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    files: ['store/public/**/*.js'],
    languageOptions: { globals: { ...globals.browser } },
  },
);
