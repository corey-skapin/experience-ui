/**
 * IPC channel name constants for all Electron main ↔ renderer communication.
 * Organized by domain per specs/001-api-ui-generator/contracts/electron-ipc-channels.md.
 * All channel names are string literals for runtime safety.
 */

// ─── CLI domain ────────────────────────────────────────────────────────────

export const CLI_CHANNELS = {
  // Request/response (invoke/handle)
  SEND_MESSAGE: 'cli:send-message',
  GET_STATUS: 'cli:get-status',
  RESTART: 'cli:restart',
  // Push notifications (main → renderer)
  STATUS_CHANGED: 'cli:status-changed',
  STREAM_RESPONSE: 'cli:stream-response',
} as const

// ─── Auth domain ───────────────────────────────────────────────────────────

export const AUTH_CHANNELS = {
  // Request/response (invoke/handle)
  CONFIGURE: 'auth:configure',
  TEST_CONNECTION: 'auth:test-connection',
  GET_CONNECTION_STATUS: 'auth:get-connection-status',
  CLEAR_CREDENTIALS: 'auth:clear-credentials',
  START_OAUTH_FLOW: 'auth:start-oauth-flow',
  // Push notifications (main → renderer)
  TOKEN_EXPIRED: 'auth:token-expired',
  TOKEN_REFRESHED: 'auth:token-refreshed',
  CONNECTION_STATUS_CHANGED: 'auth:connection-status-changed',
} as const

// ─── Proxy domain ──────────────────────────────────────────────────────────

export const PROXY_CHANNELS = {
  // Request/response (invoke/handle)
  API_REQUEST: 'proxy:api-request',
} as const

// ─── Versions domain ───────────────────────────────────────────────────────

export const VERSIONS_CHANNELS = {
  // Request/response (invoke/handle)
  SAVE_SNAPSHOT: 'versions:save-snapshot',
  LIST: 'versions:list',
  LOAD_CODE: 'versions:load-code',
  GET_DIFF: 'versions:get-diff',
} as const

// ─── Plugins domain ────────────────────────────────────────────────────────

export const PLUGINS_CHANNELS = {
  // Request/response (invoke/handle)
  INSTALL: 'plugins:install',
  UNINSTALL: 'plugins:uninstall',
  LIST: 'plugins:list',
  // Push notifications (main → renderer)
  STATUS_CHANGED: 'plugins:status-changed',
} as const

// ─── App domain ────────────────────────────────────────────────────────────

export const APP_CHANNELS = {
  // Request/response (invoke/handle)
  COMPILE_CODE: 'app:compile-code',
  VALIDATE_CODE: 'app:validate-code',
} as const
