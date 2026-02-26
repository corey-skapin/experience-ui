// playwright.config.ts
// Playwright E2E test configuration for Experience UI.
// Tests the packaged Electron application.
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  // Test directory
  testDir: './tests/e2e',

  // Pattern for test files
  testMatch: '**/*.{test,spec}.{ts,tsx}',

  // Fail the build on CI if tests are accidentally left with .only
  forbidOnly: !!process.env['CI'],

  // Retry failed tests twice in CI to handle flakiness
  retries: process.env['CI'] ? 2 : 0,

  // Parallel workers — reduce for Electron (one app instance per test file)
  workers: process.env['CI'] ? 1 : 2,

  // Reporter: HTML report + CI-friendly line reporter
  reporter: [['html', { outputFolder: 'playwright-report', open: 'never' }], ['line']],

  // Shared settings for all projects
  use: {
    // Base URL for web-based tests (not Electron)
    baseURL: 'http://localhost:5173',

    // Collect traces on failure for debugging
    trace: 'on-first-retry',

    // Screenshot on failure
    screenshot: 'only-on-failure',

    // Video on failure
    video: 'on-first-retry',
  },

  // Test projects
  projects: [
    {
      name: 'electron',
      use: {
        // Electron-specific configuration will be added when E2E tests are implemented
        ...devices['Desktop Chrome'],
      },
    },
  ],

  // Output directory for test artifacts
  outputDir: 'test-results',

  // Global timeout per test (Electron startup can be slow)
  timeout: 60_000,

  // Expect timeout for assertions
  expect: {
    timeout: 10_000,
  },
});
