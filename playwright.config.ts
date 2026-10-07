import { defineConfig, devices } from '@playwright/test';

/**
 * Tests run against YOUR Zinc Store (npm run dev). If it is not running, Playwright starts it.
 * Test ids are the selector contract (.cydeo/contract.md), so getByTestId maps to data-testid.
 */
const PORT = process.env.PORT ?? '3000';
export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.BASE_URL ?? `http://localhost:${PORT}`,
    testIdAttribute: 'data-testid',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'node scripts/dev.mjs --quiet',
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
