// src/shared/ipc-channels.ts
// Electron IPC channel name constants (T008).
// Centralises all channel strings per contracts/electron-ipc-channels.md.
// Prevents typos and enables IDE autocomplete across main/preload/renderer.

// ─── CLI Domain ───────────────────────────────────────────────────────────────

/** Send a message to the Copilot CLI subprocess. */
export const IPC_CLI_SEND_MESSAGE = 'cli:send-message' as const;

/** Get current CLI subprocess status. */
export const IPC_CLI_GET_STATUS = 'cli:get-status' as const;

/** Force restart the CLI subprocess. */
export const IPC_CLI_RESTART = 'cli:restart' as const;

// ─── CLI Push Notifications ──────────────────────────────────────────────────

/** Push: CLI subprocess status has changed. */
export const IPC_CLI_STATUS_CHANGED = 'cli:status-changed' as const;

/** Push: Streaming response chunk from CLI. */
export const IPC_CLI_STREAM_RESPONSE = 'cli:stream-response' as const;

// ─── Auth Domain ─────────────────────────────────────────────────────────────

/** Set up authentication for an API base URL. */
export const IPC_AUTH_CONFIGURE = 'auth:configure' as const;

/** Test API connectivity with current credentials. */
export const IPC_AUTH_TEST_CONNECTION = 'auth:test-connection' as const;

/** Get current connection status for a base URL. */
export const IPC_AUTH_GET_CONNECTION_STATUS = 'auth:get-connection-status' as const;

/** Initiate OAuth 2.0 PKCE flow in a dedicated browser window. */
export const IPC_AUTH_START_OAUTH_FLOW = 'auth:start-oauth-flow' as const;

/** Remove stored credentials for a base URL. */
export const IPC_AUTH_CLEAR_CREDENTIALS = 'auth:clear-credentials' as const;

// ─── Auth Push Notifications ─────────────────────────────────────────────────

/** Push: Credentials for a base URL have expired. */
export const IPC_AUTH_TOKEN_EXPIRED = 'auth:token-expired' as const;

/** Push: Credentials were automatically refreshed. */
export const IPC_AUTH_TOKEN_REFRESHED = 'auth:token-refreshed' as const;

/** Push: Connection status for a base URL has changed. */
export const IPC_AUTH_CONNECTION_STATUS_CHANGED = 'auth:connection-status-changed' as const;

// ─── Proxy Domain ────────────────────────────────────────────────────────────

/** Proxy an API request through the main process. */
export const IPC_PROXY_API_REQUEST = 'proxy:api-request' as const;

// ─── Versions Domain ─────────────────────────────────────────────────────────

/** Save a new interface version to disk. */
export const IPC_VERSIONS_SAVE_SNAPSHOT = 'versions:save-snapshot' as const;

/** List all versions for an interface. */
export const IPC_VERSIONS_LIST = 'versions:list' as const;

/** Load generated code for a specific version. */
export const IPC_VERSIONS_LOAD_CODE = 'versions:load-code' as const;

/** Get a diff between two versions. */
export const IPC_VERSIONS_GET_DIFF = 'versions:get-diff' as const;

// ─── Plugins Domain ──────────────────────────────────────────────────────────

/** Install a tool/plugin. */
export const IPC_PLUGINS_INSTALL = 'plugins:install' as const;

/** Uninstall a plugin. */
export const IPC_PLUGINS_UNINSTALL = 'plugins:uninstall' as const;

/** List all installed plugins. */
export const IPC_PLUGINS_LIST = 'plugins:list' as const;

// ─── Plugins Push Notifications ──────────────────────────────────────────────

/** Push: Plugin installation/lifecycle status changed. */
export const IPC_PLUGINS_STATUS_CHANGED = 'plugins:status-changed' as const;

// ─── App Domain ──────────────────────────────────────────────────────────────

/** Get the application version. */
export const IPC_APP_GET_VERSION = 'app:get-version' as const;

/** Compile generated React/JSX code via esbuild. */
export const IPC_APP_COMPILE_CODE = 'app:compile-code' as const;

/** Validate generated code for disallowed patterns before sandbox injection. */
export const IPC_APP_VALIDATE_CODE = 'app:validate-code' as const;
