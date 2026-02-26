import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

// Vitest configuration for main process tests (Node.js environment)
export default defineConfig({
  test: {
    name: 'node',
    environment: 'node',
    globals: true,
    setupFiles: ['tests/setup/vitest-setup-node.ts'],
    include: [
      'src/main/**/*.test.ts',
      'tests/unit/main/**/*.test.ts',
      'tests/integration/main/**/*.test.ts',
    ],
    exclude: ['tests/e2e/**', 'node_modules/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: 'coverage-node',
      thresholds: {
        lines: 80,
        branches: 80,
        functions: 80,
        statements: 80,
      },
      include: ['src/main/**', 'src/shared/**'],
      exclude: ['src/**/*.test.ts', 'src/**/*.d.ts', 'src/main/index.ts'],
    },
  },
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'src/shared'),
    },
  },
})
