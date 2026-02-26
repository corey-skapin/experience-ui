// CLI domain
export const IPC_CLI_SEND_MESSAGE = 'cli:send-message' as const;
export const IPC_CLI_GET_STATUS = 'cli:get-status' as const;
export const IPC_CLI_RESTART = 'cli:restart' as const;
// CLI push notifications
export const IPC_CLI_STATUS_CHANGED = 'cli:status-changed' as const;
export const IPC_CLI_STREAM_RESPONSE = 'cli:stream-response' as const;

// Auth domain
export const IPC_AUTH_CONFIGURE = 'auth:configure' as const;
export const IPC_AUTH_TEST_CONNECTION = 'auth:test-connection' as const;
export const IPC_AUTH_GET_CONNECTION_STATUS = 'auth:get-connection-status' as const;
export const IPC_AUTH_START_OAUTH_FLOW = 'auth:start-oauth-flow' as const;
export const IPC_AUTH_CLEAR_CREDENTIALS = 'auth:clear-credentials' as const;
// Auth push notifications
export const IPC_AUTH_TOKEN_EXPIRED = 'auth:token-expired' as const;
export const IPC_AUTH_TOKEN_REFRESHED = 'auth:token-refreshed' as const;
export const IPC_AUTH_CONNECTION_STATUS_CHANGED = 'auth:connection-status-changed' as const;

// Proxy domain
export const IPC_PROXY_API_REQUEST = 'proxy:api-request' as const;

// Versions domain
export const IPC_VERSIONS_SAVE_SNAPSHOT = 'versions:save-snapshot' as const;
export const IPC_VERSIONS_LIST = 'versions:list' as const;
export const IPC_VERSIONS_LOAD_CODE = 'versions:load-code' as const;
export const IPC_VERSIONS_GET_DIFF = 'versions:get-diff' as const;

// Plugins domain
export const IPC_PLUGINS_INSTALL = 'plugins:install' as const;
export const IPC_PLUGINS_UNINSTALL = 'plugins:uninstall' as const;
export const IPC_PLUGINS_LIST = 'plugins:list' as const;
// Plugins push notifications
export const IPC_PLUGINS_STATUS_CHANGED = 'plugins:status-changed' as const;

// App domain
export const IPC_APP_COMPILE_CODE = 'app:compile-code' as const;
export const IPC_APP_VALIDATE_CODE = 'app:validate-code' as const;

// All channel names as a union type for type safety
export type IPCChannel =
  | typeof IPC_CLI_SEND_MESSAGE
  | typeof IPC_CLI_GET_STATUS
  | typeof IPC_CLI_RESTART
  | typeof IPC_CLI_STATUS_CHANGED
  | typeof IPC_CLI_STREAM_RESPONSE
  | typeof IPC_AUTH_CONFIGURE
  | typeof IPC_AUTH_TEST_CONNECTION
  | typeof IPC_AUTH_GET_CONNECTION_STATUS
  | typeof IPC_AUTH_START_OAUTH_FLOW
  | typeof IPC_AUTH_CLEAR_CREDENTIALS
  | typeof IPC_AUTH_TOKEN_EXPIRED
  | typeof IPC_AUTH_TOKEN_REFRESHED
  | typeof IPC_AUTH_CONNECTION_STATUS_CHANGED
  | typeof IPC_PROXY_API_REQUEST
  | typeof IPC_VERSIONS_SAVE_SNAPSHOT
  | typeof IPC_VERSIONS_LIST
  | typeof IPC_VERSIONS_LOAD_CODE
  | typeof IPC_VERSIONS_GET_DIFF
  | typeof IPC_PLUGINS_INSTALL
  | typeof IPC_PLUGINS_UNINSTALL
  | typeof IPC_PLUGINS_LIST
  | typeof IPC_PLUGINS_STATUS_CHANGED
  | typeof IPC_APP_COMPILE_CODE
  | typeof IPC_APP_VALIDATE_CODE;
