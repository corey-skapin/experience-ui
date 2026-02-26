/**
 * Vitest setup file for renderer process tests (jsdom environment).
 * Configures React Testing Library, jest-dom matchers, and global mocks.
 */
import '@testing-library/jest-dom'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

// Clean up after each test to prevent memory leaks and state pollution
afterEach(() => {
  cleanup()
})

// Mock the Electron IPC bridge that is injected by the preload script
Object.defineProperty(window, 'experienceUI', {
  value: {
    cli: {
      sendMessage: vi.fn(),
      getStatus: vi.fn(),
      restart: vi.fn(),
      onStatusChanged: vi.fn(() => vi.fn()),
      onStreamResponse: vi.fn(() => vi.fn()),
    },
    auth: {
      configure: vi.fn(),
      testConnection: vi.fn(),
      getConnectionStatus: vi.fn(),
      clearCredentials: vi.fn(),
      startOAuthFlow: vi.fn(),
      onTokenExpired: vi.fn(() => vi.fn()),
      onConnectionStatusChanged: vi.fn(() => vi.fn()),
    },
    proxy: {
      apiRequest: vi.fn(),
    },
    versions: {
      saveSnapshot: vi.fn(),
      list: vi.fn(),
      loadCode: vi.fn(),
      getDiff: vi.fn(),
    },
    plugins: {
      install: vi.fn(),
      uninstall: vi.fn(),
      list: vi.fn(),
      enable: vi.fn(),
      disable: vi.fn(),
    },
    app: {
      compileCode: vi.fn(),
      validateCode: vi.fn(),
    },
  },
  writable: true,
  configurable: true,
})

// Mock ResizeObserver (not available in jsdom)
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// Mock IntersectionObserver (not available in jsdom)
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// Mock matchMedia (not available in jsdom)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})
