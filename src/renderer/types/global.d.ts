/**
 * Global window type augmentation for the Electron contextBridge.
 * Declares ExperienceUIBridge on window.experienceUI using shared IPC types.
 */
import type {
  CLISendMessageRequest,
  CLISendMessageResponse,
  CLIStatusResponse,
  CLIRestartResponse,
  CLIStreamResponseEvent,
  AuthConfigureRequest,
  AuthConfigureResponse,
  AuthTestRequest,
  AuthTestResponse,
  AuthStatusRequest,
  AuthStatusResponse,
  AuthClearRequest,
  AuthClearResponse,
  OAuthFlowRequest,
  OAuthFlowResponse,
  TokenExpiredEvent,
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
} from '../../shared/types/ipc'

export interface ExperienceUIBridge {
  cli: {
    sendMessage: (request: CLISendMessageRequest) => Promise<CLISendMessageResponse>
    getStatus: () => Promise<CLIStatusResponse>
    restart: () => Promise<CLIRestartResponse>
    onStatusChanged: (callback: (event: CLIStatusResponse) => void) => () => void
    onStreamResponse: (callback: (event: CLIStreamResponseEvent) => void) => () => void
  }
  auth: {
    configure: (request: AuthConfigureRequest) => Promise<AuthConfigureResponse>
    testConnection: (request: AuthTestRequest) => Promise<AuthTestResponse>
    getConnectionStatus: (request: AuthStatusRequest) => Promise<AuthStatusResponse>
    clearCredentials: (request: AuthClearRequest) => Promise<AuthClearResponse>
    startOAuthFlow: (request: OAuthFlowRequest) => Promise<OAuthFlowResponse>
    onTokenExpired: (callback: (event: TokenExpiredEvent) => void) => () => void
    onConnectionStatusChanged: (
      callback: (event: ConnectionStatusChangedEvent) => void,
    ) => () => void
  }
  proxy: {
    apiRequest: (request: ProxyAPIRequest) => Promise<ProxyAPIResponse>
  }
  versions: {
    saveSnapshot: (request: VersionSaveRequest) => Promise<VersionSaveResponse>
    list: (request: VersionListRequest) => Promise<VersionListResponse>
    loadCode: (request: VersionLoadRequest) => Promise<VersionLoadResponse>
    getDiff: (request: VersionDiffRequest) => Promise<VersionDiffResponse>
  }
  plugins: {
    install: (request: PluginInstallRequest) => Promise<PluginInstallResponse>
    uninstall: (request: PluginUninstallRequest) => Promise<PluginUninstallResponse>
    list: () => Promise<PluginListResponse>
    onStatusChanged: (callback: (event: PluginStatusChangedEvent) => void) => () => void
  }
  app: {
    compileCode: (request: CompileCodeRequest) => Promise<CompileCodeResponse>
    validateCode: (request: ValidateCodeRequest) => Promise<ValidateCodeResponse>
  }
}

declare global {
  interface Window {
    experienceUI: ExperienceUIBridge
  }
}

export {}
