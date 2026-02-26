/**
 * Electron preload script.
 * Exposes the typed ExperienceUIBridge interface to the renderer via contextBridge.
 * The renderer process NEVER has direct access to Node.js or Electron APIs.
 * Matches the contract in specs/001-api-ui-generator/contracts/electron-ipc-channels.md.
 */
import { contextBridge, ipcRenderer } from 'electron'
import {
  CLI_CHANNELS,
  AUTH_CHANNELS,
  PROXY_CHANNELS,
  VERSIONS_CHANNELS,
  PLUGINS_CHANNELS,
  APP_CHANNELS,
} from '../shared/ipc-channels'
import type {
  CLISendMessageRequest,
  CLISendMessageResponse,
  CLIStatusResponse,
  CLIRestartResponse,
  CLIStatusChangedEvent,
  CLIStreamResponseEvent,
  AuthConfigureRequest,
  AuthConfigureResponse,
  AuthTestRequest,
  AuthTestResponse,
  AuthStatusRequest,
  AuthStatusResponse,
  OAuthFlowRequest,
  OAuthFlowResponse,
  AuthClearRequest,
  AuthClearResponse,
  TokenExpiredEvent,
  TokenRefreshedEvent,
  ConnectionStatusChangedEvent,
  ProxyAPIRequest,
  ProxyAPIResponse,
  VersionSaveRequest,
  VersionSaveResponse,
  VersionListRequest,
  VersionListResponse,
  VersionLoadRequest,
  VersionLoadResponse,
  VersionDiffRequest,
  VersionDiffResponse,
  PluginInstallRequest,
  PluginInstallResponse,
  PluginUninstallRequest,
  PluginUninstallResponse,
  PluginListResponse,
  PluginStatusChangedEvent,
  CompileCodeRequest,
  CompileCodeResponse,
  ValidateCodeRequest,
  ValidateCodeResponse,
} from '../shared/types/ipc'

/** Type-safe ipcRenderer.invoke wrapper. */
function invoke<TResponse>(channel: string, ...args: unknown[]): Promise<TResponse> {
  return ipcRenderer.invoke(channel, ...args) as Promise<TResponse>
}

/**
 * Subscribe to a push-notification channel.
 * Returns an unsubscribe function that removes the listener when called.
 */
function subscribe<TEvent>(channel: string, listener: (payload: TEvent) => void): () => void {
  const handler = (_event: Electron.IpcRendererEvent, payload: TEvent): void => {
    listener(payload)
  }
  ipcRenderer.on(channel, handler)
  return () => {
    ipcRenderer.removeListener(channel, handler)
  }
}

// ─── ExperienceUIBridge implementation ────────────────────────────────────

const bridge = {
  cli: {
    sendMessage: (request: CLISendMessageRequest): Promise<CLISendMessageResponse> =>
      invoke<CLISendMessageResponse>(CLI_CHANNELS.SEND_MESSAGE, request),

    getStatus: (): Promise<CLIStatusResponse> => invoke<CLIStatusResponse>(CLI_CHANNELS.GET_STATUS),

    restart: (): Promise<CLIRestartResponse> => invoke<CLIRestartResponse>(CLI_CHANNELS.RESTART),

    onStatusChanged: (callback: (event: CLIStatusChangedEvent) => void): (() => void) =>
      subscribe<CLIStatusChangedEvent>(CLI_CHANNELS.STATUS_CHANGED, callback),

    onStreamResponse: (callback: (event: CLIStreamResponseEvent) => void): (() => void) =>
      subscribe<CLIStreamResponseEvent>(CLI_CHANNELS.STREAM_RESPONSE, callback),
  },

  auth: {
    configure: (request: AuthConfigureRequest): Promise<AuthConfigureResponse> =>
      invoke<AuthConfigureResponse>(AUTH_CHANNELS.CONFIGURE, request),

    testConnection: (request: AuthTestRequest): Promise<AuthTestResponse> =>
      invoke<AuthTestResponse>(AUTH_CHANNELS.TEST_CONNECTION, request),

    getConnectionStatus: (request: AuthStatusRequest): Promise<AuthStatusResponse> =>
      invoke<AuthStatusResponse>(AUTH_CHANNELS.GET_CONNECTION_STATUS, request),

    startOAuthFlow: (request: OAuthFlowRequest): Promise<OAuthFlowResponse> =>
      invoke<OAuthFlowResponse>(AUTH_CHANNELS.START_OAUTH_FLOW, request),

    clearCredentials: (request: AuthClearRequest): Promise<AuthClearResponse> =>
      invoke<AuthClearResponse>(AUTH_CHANNELS.CLEAR_CREDENTIALS, request),

    onTokenExpired: (callback: (event: TokenExpiredEvent) => void): (() => void) =>
      subscribe<TokenExpiredEvent>(AUTH_CHANNELS.TOKEN_EXPIRED, callback),

    onTokenRefreshed: (callback: (event: TokenRefreshedEvent) => void): (() => void) =>
      subscribe<TokenRefreshedEvent>(AUTH_CHANNELS.TOKEN_REFRESHED, callback),

    onConnectionStatusChanged: (
      callback: (event: ConnectionStatusChangedEvent) => void,
    ): (() => void) =>
      subscribe<ConnectionStatusChangedEvent>(AUTH_CHANNELS.CONNECTION_STATUS_CHANGED, callback),
  },

  proxy: {
    apiRequest: (request: ProxyAPIRequest): Promise<ProxyAPIResponse> =>
      invoke<ProxyAPIResponse>(PROXY_CHANNELS.API_REQUEST, request),
  },

  versions: {
    saveSnapshot: (request: VersionSaveRequest): Promise<VersionSaveResponse> =>
      invoke<VersionSaveResponse>(VERSIONS_CHANNELS.SAVE_SNAPSHOT, request),

    list: (request: VersionListRequest): Promise<VersionListResponse> =>
      invoke<VersionListResponse>(VERSIONS_CHANNELS.LIST, request),

    loadCode: (request: VersionLoadRequest): Promise<VersionLoadResponse> =>
      invoke<VersionLoadResponse>(VERSIONS_CHANNELS.LOAD_CODE, request),

    getDiff: (request: VersionDiffRequest): Promise<VersionDiffResponse> =>
      invoke<VersionDiffResponse>(VERSIONS_CHANNELS.GET_DIFF, request),
  },

  plugins: {
    install: (request: PluginInstallRequest): Promise<PluginInstallResponse> =>
      invoke<PluginInstallResponse>(PLUGINS_CHANNELS.INSTALL, request),

    uninstall: (request: PluginUninstallRequest): Promise<PluginUninstallResponse> =>
      invoke<PluginUninstallResponse>(PLUGINS_CHANNELS.UNINSTALL, request),

    list: (): Promise<PluginListResponse> => invoke<PluginListResponse>(PLUGINS_CHANNELS.LIST),

    onStatusChanged: (callback: (event: PluginStatusChangedEvent) => void): (() => void) =>
      subscribe<PluginStatusChangedEvent>(PLUGINS_CHANNELS.STATUS_CHANGED, callback),
  },

  app: {
    compileCode: (request: CompileCodeRequest): Promise<CompileCodeResponse> =>
      invoke<CompileCodeResponse>(APP_CHANNELS.COMPILE_CODE, request),

    validateCode: (request: ValidateCodeRequest): Promise<ValidateCodeResponse> =>
      invoke<ValidateCodeResponse>(APP_CHANNELS.VALIDATE_CODE, request),
  },
} as const

contextBridge.exposeInMainWorld('experienceUI', bridge)

/** Exported type for use in renderer TypeScript declarations. */
export type ExperienceUIBridge = typeof bridge
