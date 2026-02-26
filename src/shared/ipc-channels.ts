/**
 * IPC channel name constants for all Electron main ↔ renderer communication.
 * Organized by domain. All channel names are string literals for runtime safety.
 */

export const CLI_CHANNELS = {
  SEND_MESSAGE: 'cli:send-message',
  GET_STATUS: 'cli:get-status',
  RESTART: 'cli:restart',
  // Push notifications (main → renderer)
  STATUS_CHANGED: 'cli:status-changed',
  STREAM_RESPONSE: 'cli:stream-response',
} as const

export const AUTH_CHANNELS = {
  CONFIGURE: 'auth:configure',
  TEST_CONNECTION: 'auth:test-connection',
  GET_CONNECTION_STATUS: 'auth:get-connection-status',
  CLEAR_CREDENTIALS: 'auth:clear-credentials',
  START_OAUTH_FLOW: 'auth:start-oauth-flow',
  // Push notifications
  TOKEN_EXPIRED: 'auth:token-expired',
  CONNECTION_STATUS_CHANGED: 'auth:connection-status-changed',
  TOKEN_REFRESHED: 'auth:token-refreshed',
} as const

export const PROXY_CHANNELS = {
  API_REQUEST: 'proxy:api-request',
} as const

export const VERSIONS_CHANNELS = {
  SAVE_SNAPSHOT: 'versions:save-snapshot',
  LIST: 'versions:list',
  LOAD_CODE: 'versions:load-code',
  GET_DIFF: 'versions:get-diff',
} as const

export const PLUGINS_CHANNELS = {
  INSTALL: 'plugins:install',
  UNINSTALL: 'plugins:uninstall',
  LIST: 'plugins:list',
  ENABLE: 'plugins:enable',
  DISABLE: 'plugins:disable',
  // Push notifications
  INSTALLED: 'plugins:installed',
  UNINSTALLED: 'plugins:uninstalled',
  STATUS_CHANGED: 'plugins:status-changed',
} as const

export const APP_CHANNELS = {
  COMPILE_CODE: 'app:compile-code',
  VALIDATE_CODE: 'app:validate-code',
} as const
