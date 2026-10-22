import { defineConfig, devices } from '@playwright/test';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * ZincBank suite. Runs against the shared ZincBank lab build, not the Zinc Store in this Codespace.
 * Run: npm run zb:test   (all specs)   or   npm run zb:spec -- login   (one area, with the gates)
 * The funder login lives in zincbank/.env (ZB_FUNDER_EMAIL, ZB_FUNDER_PASSWORD); it is never committed.
 */
const envFile = join(import.meta.dirname, '.env');
if (existsSync(envFile)) process.loadEnvFile(envFile);

export default defineConfig({
  testDir: process.env.ZB_TEST_DIR ?? './tests',
  fullyParallel: true,
  workers: Number(process.env.ZB_WORKERS ?? 4),
  forbidOnly: !!process.env.CI,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 20_000 },
  reporter: [['list'], ['html', { open: 'never', outputFolder: '../artifacts/zb/report' }]],
  outputDir: '../artifacts/zb/test-results',
  use: {
    baseURL: process.env.ZB_BASE_URL ?? 'https://zincbank-lab.vercel.app',
    testIdAttribute: 'data-testid',
    navigationTimeout: 45_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
