// vitest.config.ts
// Vitest configuration for unit and integration tests.
// Coverage target: ≥80% per feature branch (enforced in CI).
import { resolve } from 'path';

import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    // Use jsdom environment for React component tests
    environment: 'jsdom',

    // Global test setup file (imports jest-dom matchers, axe-core setup)
    setupFiles: ['./tests/setup.ts'],

    // Include test files from src (co-located) and tests/ directory
    include: [
      'src/**/*.{test,spec}.{ts,tsx}',
      'tests/unit/**/*.{test,spec}.{ts,tsx}',
      'tests/integration/**/*.{test,spec}.{ts,tsx}',
    ],

    // Exclude E2E tests (handled by Playwright) and node_modules
    exclude: ['node_modules/**', 'out/**', 'dist/**', 'tests/e2e/**', 'playwright.config.ts'],

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html', 'json'],
      reportsDirectory: './coverage',
      // Enforce ≥80% coverage gate per constitution
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
      // Include all source files in coverage, even if not directly tested
      include: [
        'src/main/**/*.{ts,tsx}',
        'src/renderer/**/*.{ts,tsx}',
        'src/sandbox/**/*.{ts,tsx}',
        'src/shared/**/*.{ts,tsx}',
      ],
      exclude: [
        'src/**/*.d.ts',
        'src/**/index.html',
        'src/main/index.ts', // Electron entry bootstrap
        'src/renderer/index.tsx', // React root mount
      ],
    },

    // Globals: allow describe/it/expect without imports (matches jest API)
    globals: true,

    // Fake timers: tests must not depend on real time
    fakeTimers: {
      toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'],
    },

    // Retry flaky tests once before marking as failed
    retry: 1,

    // Reporter
    reporter: ['verbose'],
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src/renderer'),
    },
  },
});
