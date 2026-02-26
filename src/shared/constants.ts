// Panel layout
export const DEFAULT_CHAT_PANEL_WIDTH = 30; // percent
export const MAX_CHAT_PANEL_WIDTH = 85; // percent
export const MIN_CHAT_PANEL_WIDTH = 15; // percent
export const DEFAULT_CONTENT_PANEL_WIDTH = 70; // percent

// CLI subprocess
export const MAX_RESTART_RETRIES = 5;
export const CLI_REQUEST_TIMEOUT_MS = 30_000;
export const CLI_GENERATE_TIMEOUT_MS = 60_000;
export const CLI_CUSTOMIZE_TIMEOUT_MS = 30_000;
export const CLI_CHAT_TIMEOUT_MS = 15_000;
export const CLI_INITIALIZE_TIMEOUT_MS = 10_000;
export const CLI_MAX_QUEUE_DEPTH = 100;

// Network proxy
export const PROXY_REQUEST_TIMEOUT_MS = 30_000;
export const NETWORK_REQUEST_TIMEOUT_MS = 10_000;

// Health checks
export const HEALTH_CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
export const TOKEN_REFRESH_BUFFER_MS = 60_000; // refresh 1 min before expiry

// API spec limits
export const MAX_SPEC_SIZE_BYTES = 50 * 1024 * 1024; // 50MB

// CSP policy template for sandboxed iframes
export const SANDBOX_CSP_TEMPLATE = [
  "default-src 'none'",
  "script-src 'nonce-{NONCE}'",
  "style-src 'nonce-{NONCE}' 'unsafe-inline'",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  'img-src data: blob:',
  'font-src data:',
].join('; ');

// Disallowed code patterns for generated UI validation
export const DISALLOWED_CODE_PATTERNS: ReadonlyArray<{
  pattern: string;
  regex: RegExp;
  severity: 'error' | 'warning';
  description: string;
}> = [
  {
    pattern: 'eval',
    regex: /\beval\s*\(/g,
    severity: 'error',
    description: 'eval() is not allowed in generated code',
  },
  {
    pattern: 'Function constructor',
    regex: /new\s+Function\s*\(/g,
    severity: 'error',
    description: 'Function() constructor is not allowed',
  },
  {
    pattern: 'document.cookie',
    regex: /document\.cookie/g,
    severity: 'error',
    description: 'document.cookie access is not allowed',
  },
  {
    pattern: 'window.parent',
    regex: /window\.parent/g,
    severity: 'error',
    description: 'window.parent access is not allowed',
  },
  {
    pattern: 'window.top',
    regex: /window\.top/g,
    severity: 'error',
    description: 'window.top access is not allowed',
  },
  {
    pattern: 'localStorage',
    regex: /localStorage/g,
    severity: 'warning',
    description: 'localStorage usage may expose sensitive data',
  },
  {
    pattern: 'sessionStorage',
    regex: /sessionStorage/g,
    severity: 'warning',
    description: 'sessionStorage usage may expose sensitive data',
  },
  {
    pattern: 'Node.js require',
    regex: /\brequire\s*\(/g,
    severity: 'error',
    description: 'Node.js require() is not allowed in sandbox',
  },
  {
    pattern: 'Node.js import',
    regex: /\bimport\s*\(/g,
    severity: 'error',
    description: 'Dynamic import() is not allowed in sandbox',
  },
  {
    pattern: 'XMLHttpRequest',
    regex: /new\s+XMLHttpRequest\s*\(\s*\)/g,
    severity: 'error',
    description: 'Direct XMLHttpRequest is not allowed; use the proxy',
  },
];

// Sandbox postMessage type allowlists
export const HOST_ALLOWED_MESSAGE_TYPES = [
  'READY',
  'RENDER_COMPLETE',
  'NETWORK_REQUEST',
  'LOG',
  'ERROR',
  'UI_EVENT',
] as const;

export const SANDBOX_ALLOWED_MESSAGE_TYPES = [
  'INIT',
  'RENDER_DATA',
  'THEME_CHANGE',
  'RESIZE',
  'NETWORK_RESPONSE',
  'DESTROY',
] as const;

export type HostAllowedMessageType = (typeof HOST_ALLOWED_MESSAGE_TYPES)[number];
export type SandboxAllowedMessageType = (typeof SANDBOX_ALLOWED_MESSAGE_TYPES)[number];

// Version history
export const VERSION_DIFF_LRU_CACHE_SIZE = 20;

// Spec validation
export const SUPPORTED_SPEC_FORMATS = ['openapi3', 'swagger2', 'graphql'] as const;
export const UNSUPPORTED_SPEC_FORMATS = ['raml', 'wsdl', 'asyncapi'] as const;
