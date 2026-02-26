import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright E2E test configuration.
 * Tests the built Electron application end-to-end.
 */
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false, // E2E tests must run sequentially for Electron
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'playwright-results.json' }],
    process.env.CI ? ['github'] : ['list'],
  ],
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  projects: [
    {
      name: 'electron',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
  ],
  // Build the app before running E2E tests
  globalSetup: './tests/e2e/global-setup.ts',
})
