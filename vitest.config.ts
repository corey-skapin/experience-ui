import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// Vitest configuration for renderer process tests (React components, hooks, services)
export default defineConfig({
  plugins: [react()],
  test: {
    name: 'renderer',
    environment: 'jsdom',
    globals: true,
    setupFiles: ['tests/setup/vitest-setup.ts'],
    include: [
      'src/renderer/**/*.test.{ts,tsx}',
      'src/sandbox/**/*.test.{ts,tsx}',
      'tests/unit/**/*.test.{ts,tsx}',
      'tests/integration/**/*.test.{ts,tsx}',
    ],
    exclude: ['tests/e2e/**', 'node_modules/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: 'coverage',
      thresholds: {
        lines: 80,
        branches: 80,
        functions: 80,
        statements: 80,
      },
      include: ['src/renderer/**', 'src/sandbox/**', 'src/shared/**'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/**/*.d.ts', 'src/renderer/index.tsx'],
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src/renderer'),
      '@shared': resolve(__dirname, 'src/shared'),
    },
  },
})
