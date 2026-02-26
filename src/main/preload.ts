// src/main/preload.ts
// Preload script (T011) — runs in renderer context with Node.js API access.
// Exposes the full ExperienceUIBridge interface via contextBridge.
// Per contracts/electron-ipc-channels.md.
import { contextBridge, ipcRenderer } from 'electron';
import type { IpcRendererEvent } from 'electron';

import {
  IPC_APP_COMPILE_CODE,
  IPC_APP_GET_VERSION,
  IPC_APP_VALIDATE_CODE,
  IPC_AUTH_CLEAR_CREDENTIALS,
  IPC_AUTH_CONFIGURE,
  IPC_AUTH_CONNECTION_STATUS_CHANGED,
  IPC_AUTH_GET_CONNECTION_STATUS,
  IPC_AUTH_START_OAUTH_FLOW,
  IPC_AUTH_TEST_CONNECTION,
  IPC_AUTH_TOKEN_EXPIRED,
  IPC_AUTH_TOKEN_REFRESHED,
  IPC_CLI_GET_STATUS,
  IPC_CLI_RESTART,
  IPC_CLI_SEND_MESSAGE,
  IPC_CLI_STATUS_CHANGED,
  IPC_CLI_STREAM_RESPONSE,
  IPC_PLUGINS_INSTALL,
  IPC_PLUGINS_LIST,
  IPC_PLUGINS_STATUS_CHANGED,
  IPC_PLUGINS_UNINSTALL,
  IPC_PROXY_API_REQUEST,
  IPC_VERSIONS_GET_DIFF,
  IPC_VERSIONS_LIST,
  IPC_VERSIONS_LOAD_CODE,
  IPC_VERSIONS_SAVE_SNAPSHOT,
} from '../shared/ipc-channels';

// ─── Type Imports (IPC contract shapes) ──────────────────────────────────────

import type {
  AuthConfigureRequest,
  AuthConfigureResponse,
  AuthClearRequest,
  AuthClearResponse,
  AuthStatusRequest,
  AuthStatusResponse,
  AuthTestRequest,
  AuthTestResponse,
  CLIRestartResponse,
  CLISendMessageRequest,
  CLISendMessageResponse,
  CLIStatusChangedEvent,
  CLIStatusResponse,
  CLIStreamResponseEvent,
  CompileCodeRequest,
  CompileCodeResponse,
  ConnectionStatusChangedEvent,
  OAuthFlowRequest,
  OAuthFlowResponse,
  PluginInstallRequest,
  PluginInstallResponse,
  PluginListResponse,
  PluginStatusChangedEvent,
  PluginUninstallRequest,
  PluginUninstallResponse,
  ProxyAPIRequest,
  ProxyAPIResponse,
  TokenExpiredEvent,
  TokenRefreshedEvent,
  ValidateCodeRequest,
  ValidateCodeResponse,
  VersionDiffRequest,
  VersionDiffResponse,
  VersionListRequest,
  VersionListResponse,
  VersionLoadRequest,
  VersionLoadResponse,
  VersionSaveRequest,
  VersionSaveResponse,
} from './preload-types';

// Re-export for renderer global augmentation
export type { ExperienceUIBridge } from './preload-types';

// ─── Helper: register a one-time-cleanup push notification listener ───────────

function onPush<T>(
  channel: string,
  callback: (event: T) => void,
): () => void {
  const handler = (_: IpcRendererEvent, event: T): void => callback(event);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
}

// ─── Bridge Implementation ───────────────────────────────────────────────────

const bridge = {
  // ── CLI ────────────────────────────────────────────────────────────────────
  cli: {
    sendMessage: (req: CLISendMessageRequest): Promise<CLISendMessageResponse> =>
      ipcRenderer.invoke(IPC_CLI_SEND_MESSAGE, req),

    getStatus: (): Promise<CLIStatusResponse> =>
      ipcRenderer.invoke(IPC_CLI_GET_STATUS),

    restart: (): Promise<CLIRestartResponse> =>
      ipcRenderer.invoke(IPC_CLI_RESTART),

    onStatusChanged: (cb: (event: CLIStatusChangedEvent) => void): (() => void) =>
      onPush(IPC_CLI_STATUS_CHANGED, cb),

    onStreamResponse: (cb: (event: CLIStreamResponseEvent) => void): (() => void) =>
      onPush(IPC_CLI_STREAM_RESPONSE, cb),
  },

  // ── Auth ───────────────────────────────────────────────────────────────────
  auth: {
    configure: (req: AuthConfigureRequest): Promise<AuthConfigureResponse> =>
      ipcRenderer.invoke(IPC_AUTH_CONFIGURE, req),

    testConnection: (req: AuthTestRequest): Promise<AuthTestResponse> =>
      ipcRenderer.invoke(IPC_AUTH_TEST_CONNECTION, req),

    getConnectionStatus: (req: AuthStatusRequest): Promise<AuthStatusResponse> =>
      ipcRenderer.invoke(IPC_AUTH_GET_CONNECTION_STATUS, req),

    startOAuthFlow: (req: OAuthFlowRequest): Promise<OAuthFlowResponse> =>
      ipcRenderer.invoke(IPC_AUTH_START_OAUTH_FLOW, req),

    clearCredentials: (req: AuthClearRequest): Promise<AuthClearResponse> =>
      ipcRenderer.invoke(IPC_AUTH_CLEAR_CREDENTIALS, req),

    onTokenExpired: (cb: (event: TokenExpiredEvent) => void): (() => void) =>
      onPush(IPC_AUTH_TOKEN_EXPIRED, cb),

    onTokenRefreshed: (cb: (event: TokenRefreshedEvent) => void): (() => void) =>
      onPush(IPC_AUTH_TOKEN_REFRESHED, cb),

    onConnectionStatusChanged: (cb: (event: ConnectionStatusChangedEvent) => void): (() => void) =>
      onPush(IPC_AUTH_CONNECTION_STATUS_CHANGED, cb),
  },

  // ── Proxy ──────────────────────────────────────────────────────────────────
  proxy: {
    apiRequest: (req: ProxyAPIRequest): Promise<ProxyAPIResponse> =>
      ipcRenderer.invoke(IPC_PROXY_API_REQUEST, req),
  },

  // ── Versions ───────────────────────────────────────────────────────────────
  versions: {
    saveSnapshot: (req: VersionSaveRequest): Promise<VersionSaveResponse> =>
      ipcRenderer.invoke(IPC_VERSIONS_SAVE_SNAPSHOT, req),

    list: (req: VersionListRequest): Promise<VersionListResponse> =>
      ipcRenderer.invoke(IPC_VERSIONS_LIST, req),

    loadCode: (req: VersionLoadRequest): Promise<VersionLoadResponse> =>
      ipcRenderer.invoke(IPC_VERSIONS_LOAD_CODE, req),

    getDiff: (req: VersionDiffRequest): Promise<VersionDiffResponse> =>
      ipcRenderer.invoke(IPC_VERSIONS_GET_DIFF, req),
  },

  // ── Plugins ────────────────────────────────────────────────────────────────
  plugins: {
    install: (req: PluginInstallRequest): Promise<PluginInstallResponse> =>
      ipcRenderer.invoke(IPC_PLUGINS_INSTALL, req),

    uninstall: (req: PluginUninstallRequest): Promise<PluginUninstallResponse> =>
      ipcRenderer.invoke(IPC_PLUGINS_UNINSTALL, req),

    list: (): Promise<PluginListResponse> =>
      ipcRenderer.invoke(IPC_PLUGINS_LIST),

    onStatusChanged: (cb: (event: PluginStatusChangedEvent) => void): (() => void) =>
      onPush(IPC_PLUGINS_STATUS_CHANGED, cb),
  },

  // ── App ────────────────────────────────────────────────────────────────────
  app: {
    getVersion: (): Promise<string> =>
      ipcRenderer.invoke(IPC_APP_GET_VERSION),

    compileCode: (req: CompileCodeRequest): Promise<CompileCodeResponse> =>
      ipcRenderer.invoke(IPC_APP_COMPILE_CODE, req),

    validateCode: (req: ValidateCodeRequest): Promise<ValidateCodeResponse> =>
      ipcRenderer.invoke(IPC_APP_VALIDATE_CODE, req),
  },
} as const;

contextBridge.exposeInMainWorld('experienceUI', bridge);
