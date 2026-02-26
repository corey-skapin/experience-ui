// src/shared/constants.ts
// Application-wide constants shared between the main process and renderer (T009).
// All values here are immutable and have no runtime side-effects.

// ─── Layout ───────────────────────────────────────────────────────────────────

/** Default split ratio: chat panel takes 30% of available width. */
export const DEFAULT_CHAT_PANEL_WIDTH_PERCENT = 30;

/** Content area default width (complement of chat panel). */
export const DEFAULT_CONTENT_PANEL_WIDTH_PERCENT = 70;

/** Minimum chat panel width as % of total layout width. */
export const MIN_CHAT_PANEL_WIDTH_PERCENT = 15;

/** Maximum chat panel width as % of total layout width. */
export const MAX_CHAT_PANEL_WIDTH_PERCENT = 85;

// ─── CLI / Process ────────────────────────────────────────────────────────────

/** Maximum number of automatic CLI restart attempts before giving up. */
export const MAX_CLI_RESTART_RETRIES = 5;

/** Timeout in milliseconds for a single CLI request before considering it failed. */
export const CLI_REQUEST_TIMEOUT_MS = 30_000;

/** Timeout in milliseconds for CLI initialization / handshake. */
export const CLI_INIT_TIMEOUT_MS = 10_000;

/** Exponential backoff delays (ms) for CLI restarts: 5s → 10s → 30s. */
export const CLI_RESTART_BACKOFF_MS = [5_000, 10_000, 30_000] as const;

// ─── Network / Proxy ─────────────────────────────────────────────────────────

/** Default timeout in milliseconds for proxied API requests. */
export const PROXY_REQUEST_TIMEOUT_MS = 30_000;

/** Timeout in milliseconds for network health-check requests. */
export const HEALTH_CHECK_TIMEOUT_MS = 10_000;

/** Interval in milliseconds between background connection health checks (5 min). */
export const HEALTH_CHECK_INTERVAL_MS = 5 * 60 * 1_000;

/** Maximum API spec file size in bytes (50 MB). */
export const MAX_SPEC_SIZE_BYTES = 50 * 1_024 * 1_024;

// ─── Versioning ───────────────────────────────────────────────────────────────

/** Maximum number of cached version diffs (LRU). */
export const VERSION_DIFF_CACHE_SIZE = 20;

/** Default page size for version list queries. */
export const VERSION_LIST_PAGE_SIZE = 50;

// ─── CSP Policy Template ─────────────────────────────────────────────────────

/**
 * Content Security Policy for the sandboxed iframe.
 * Uses a nonce placeholder `{{NONCE}}` that must be replaced at runtime.
 * Strict default-src 'none' prevents all resource loading unless explicitly
 * whitelisted. Script and style execution requires the nonce.
 */
export const SANDBOX_CSP_TEMPLATE =
  "default-src 'none'; " +
  "script-src 'nonce-{{NONCE}}'; " +
  "style-src 'nonce-{{NONCE}}' 'unsafe-inline'; " +
  "connect-src 'self'; " +
  "img-src data: blob:; " +
  "font-src data:; " +
  "frame-ancestors 'none'; " +
  "base-uri 'none'; " +
  "form-action 'none';";

// ─── Disallowed Code Patterns ─────────────────────────────────────────────────

/**
 * Regular expression patterns for code that must be rejected before
 * sandbox injection. Per FR-034 security requirements.
 * Each entry: { pattern, description, severity }
 */
export const DISALLOWED_CODE_PATTERNS = [
  {
    pattern: /\beval\s*\(/,
    description: 'eval() is forbidden — arbitrary code execution risk',
    severity: 'error' as const,
  },
  {
    pattern: /\bnew\s+Function\s*\(/,
    description: 'new Function() is forbidden — arbitrary code execution risk',
    severity: 'error' as const,
  },
  {
    pattern: /\bFunction\s*\(/,
    description: 'Function() constructor is forbidden — arbitrary code execution risk',
    severity: 'error' as const,
  },
  {
    pattern: /\bdocument\.cookie\b/,
    description: 'document.cookie access is forbidden — credential theft risk',
    severity: 'error' as const,
  },
  {
    pattern: /\bwindow\.parent\b/,
    description: 'window.parent access is forbidden — sandbox escape risk',
    severity: 'error' as const,
  },
  {
    pattern: /\bwindow\.top\b/,
    description: 'window.top access is forbidden — sandbox escape risk',
    severity: 'error' as const,
  },
  {
    pattern: /\bwindow\.frames\b/,
    description: 'window.frames access is forbidden — sandbox escape risk',
    severity: 'error' as const,
  },
  {
    pattern: /postMessage\s*\([^)]*['"][^'"]*['"][^)]*\)/,
    description:
      'postMessage to arbitrary origins is forbidden — use only host-validated origin',
    severity: 'warning' as const,
  },
  {
    pattern: /\brequire\s*\(/,
    description: 'require() is forbidden in sandbox — no Node.js module loading',
    severity: 'error' as const,
  },
  {
    pattern: /\bimport\s*\(/,
    description: 'Dynamic import() is forbidden in sandbox code',
    severity: 'error' as const,
  },
  {
    pattern: /\blocalStorage\b/,
    description: 'localStorage access is forbidden in sandbox',
    severity: 'warning' as const,
  },
  {
    pattern: /\bsessionStorage\b/,
    description: 'sessionStorage access is forbidden in sandbox',
    severity: 'warning' as const,
  },
  {
    pattern: /\bindexedDB\b/,
    description: 'indexedDB access is forbidden in sandbox',
    severity: 'warning' as const,
  },
] as const;

// ─── Sandbox Message Type Allowlists ─────────────────────────────────────────

/**
 * Message types the host renderer accepts from the sandboxed iframe.
 * Any other message type MUST be silently ignored.
 */
export const HOST_ALLOWED_SANDBOX_MESSAGE_TYPES = [
  'READY',
  'RENDER_COMPLETE',
  'NETWORK_REQUEST',
  'LOG',
  'ERROR',
  'UI_EVENT',
] as const;

export type HostAllowedSandboxMessageType = (typeof HOST_ALLOWED_SANDBOX_MESSAGE_TYPES)[number];

/**
 * Message types the sandboxed iframe accepts from the host renderer.
 * Any other message type MUST be silently ignored.
 */
export const SANDBOX_ALLOWED_HOST_MESSAGE_TYPES = [
  'INIT',
  'RENDER_DATA',
  'THEME_CHANGE',
  'RESIZE',
  'NETWORK_RESPONSE',
  'DESTROY',
] as const;

export type SandboxAllowedHostMessageType = (typeof SANDBOX_ALLOWED_HOST_MESSAGE_TYPES)[number];
