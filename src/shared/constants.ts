/**
 * Application-wide constants shared between main and renderer processes.
 */

// Layout constants
export const LAYOUT = {
  DEFAULT_CHAT_PANEL_RATIO: 30, // percentage
  DEFAULT_CONTENT_PANEL_RATIO: 70, // percentage
  MIN_CHAT_PANEL_WIDTH_PERCENT: 15,
  MAX_CHAT_PANEL_WIDTH_PERCENT: 85,
  MIN_WINDOW_WIDTH: 1024,
  MIN_WINDOW_HEIGHT: 768,
} as const

// CLI subprocess constants
export const CLI = {
  MAX_RESTART_RETRIES: 5,
  RESTART_BACKOFF_MS: [5_000, 10_000, 30_000, 60_000, 120_000] as const,
  REQUEST_TIMEOUT_MS: 30_000,
  STREAM_IDLE_TIMEOUT_MS: 60_000,
  ENV_WHITELIST: ['PATH', 'HOME', 'SHELL', 'NODE_ENV', 'LANG', 'TERM'] as const,
} as const

// Auth constants
export const AUTH = {
  HEALTH_CHECK_INTERVAL_MS: 5 * 60_000, // 5 minutes
  TOKEN_EXPIRY_MARGIN_MS: 60_000, // 1 minute before expiry
} as const

// Version history constants
export const VERSIONS = {
  DIFF_CACHE_SIZE: 20,
  MAX_VERSIONS_PER_INTERFACE: 500,
  PAGE_SIZE: 20,
} as const

// Sandbox security constants
export const SANDBOX = {
  CSP_TEMPLATE: (nonce: string): string =>
    `default-src 'none'; ` +
    `script-src 'nonce-${nonce}'; ` +
    `style-src 'nonce-${nonce}' 'unsafe-inline'; ` +
    `connect-src 'self'; ` +
    `frame-ancestors 'none'`,

  // Message types allowed from sandbox → host
  ALLOWED_INBOUND_MESSAGE_TYPES: [
    'SANDBOX_READY',
    'NETWORK_REQUEST',
    'RENDER_COMPLETE',
    'ERROR',
    'LOG',
    'CSP_VIOLATION',
  ] as const,

  // Message types allowed from host → sandbox
  ALLOWED_OUTBOUND_MESSAGE_TYPES: [
    'INIT',
    'RENDER_DATA',
    'THEME_CHANGE',
    'RESIZE',
    'NETWORK_RESPONSE',
  ] as const,
} as const

// Code generation security: patterns disallowed in generated code
export const DISALLOWED_CODE_PATTERNS = [
  'eval(',
  'new Function(',
  'document.cookie',
  'window.parent',
  'window.top',
  'window.opener',
  'require(',
  'import(',
  '__webpack_require__',
  'process.env',
  'global.',
  'globalThis.',
] as const

// esbuild compilation settings
export const ESBUILD = {
  FORMAT: 'iife' as const,
  TARGET: 'es2020' as const,
  BUNDLE: false,
} as const
