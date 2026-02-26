// src/main/preload-types.ts
// IPC request/response type definitions for the preload bridge.
// Mirrors the contracts in electron-ipc-channels.md exactly.
// Kept separate to avoid circular imports and stay under 300 lines.

// ─── CLI Domain ───────────────────────────────────────────────────────────────

export interface CLISendMessageRequest {
  message: string;
  context?: {
    tabId: string;
    activeSpecId?: string;
    activeVersionId?: string;
  };
}

export interface CLISendMessageResponse {
  success: boolean;
  response?: string;
  error?: string;
  requestId: string;
}

export interface CLIStatusResponse {
  status: 'stopped' | 'starting' | 'running' | 'crashed' | 'restarting';
  pid: number | null;
  restartCount: number;
  pendingRequests: number;
  uptime: number | null;
}

export interface CLIRestartResponse {
  success: boolean;
  error?: string;
}

export interface CLIStatusChangedEvent {
  status: 'stopped' | 'starting' | 'running' | 'crashed' | 'restarting';
  message?: string;
}

export interface CLIStreamResponseEvent {
  requestId: string;
  chunk: string;
  done: boolean;
}

// ─── Auth Domain ─────────────────────────────────────────────────────────────

export interface AuthConfigureRequest {
  baseUrl: string;
  method:
    | { type: 'apiKey'; headerName: string; key: string }
    | { type: 'bearer'; token: string }
    | {
        type: 'oauth2';
        clientId: string;
        authEndpoint: string;
        tokenEndpoint: string;
        scopes: string[];
      };
  persist: boolean;
}

export interface AuthConfigureResponse {
  success: boolean;
  connectionId: string;
  error?: string;
}

export interface AuthTestRequest {
  baseUrl: string;
  healthCheckPath?: string;
}

export interface AuthTestResponse {
  status: 'connected' | 'degraded' | 'unreachable' | 'unauthorized';
  responseTimeMs: number;
  statusCode?: number;
  error?: string;
}

export interface AuthStatusRequest {
  baseUrl: string;
}

export interface AuthStatusResponse {
  configured: boolean;
  status: 'disconnected' | 'connected' | 'degraded' | 'expired' | 'unreachable';
  authMethod: 'apiKey' | 'bearer' | 'oauth2' | 'none';
  lastVerifiedAt: string | null;
  responseTimeMs: number | null;
}

export interface OAuthFlowRequest {
  baseUrl: string;
  clientId: string;
  authEndpoint: string;
  tokenEndpoint: string;
  scopes: string[];
  redirectUri?: string;
}

export interface OAuthFlowResponse {
  success: boolean;
  connectionId?: string;
  error?: string;
}

export interface AuthClearRequest {
  baseUrl: string;
  clearPersisted: boolean;
}

export interface AuthClearResponse {
  success: boolean;
}

export interface TokenExpiredEvent {
  baseUrl: string;
  reason: 'expired' | 'revoked' | 'invalid';
}

export interface TokenRefreshedEvent {
  baseUrl: string;
}

export interface ConnectionStatusChangedEvent {
  baseUrl: string;
  status: 'connected' | 'degraded' | 'unreachable' | 'expired';
  responseTimeMs?: number;
}

// ─── Proxy Domain ────────────────────────────────────────────────────────────

export interface ProxyAPIRequest {
  baseUrl: string;
  path: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
  timeout?: number;
}

export interface ProxyAPIResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  elapsedMs: number;
}

// ─── Versions Domain ─────────────────────────────────────────────────────────

export interface VersionSaveRequest {
  interfaceId: string;
  generatedCode: string;
  description: string;
  changeType: 'generation' | 'customization' | 'rollback';
  generationPrompt?: string;
  parentVersionId?: string;
  revertedFromVersionId?: string;
  pluginDependencies?: string[];
}

export interface VersionSaveResponse {
  success: boolean;
  versionId: string;
  versionNumber: number;
  codePath: string;
  codeHash: string;
}

export interface VersionListRequest {
  interfaceId: string;
  page?: number;
  pageSize?: number;
}

export interface VersionListResponse {
  versions: Array<{
    id: string;
    versionNumber: number;
    parentVersionId: string | null;
    changeType: string;
    description: string;
    isRevert: boolean;
    createdAt: string;
  }>;
  totalCount: number;
  page: number;
  pageSize: number;
}

export interface VersionLoadRequest {
  interfaceId: string;
  versionId: string;
}

export interface VersionLoadResponse {
  code: string;
  codeHash: string;
  versionNumber: number;
}

export interface VersionDiffRequest {
  interfaceId: string;
  fromVersionId: string;
  toVersionId: string;
}

export interface VersionDiffResponse {
  additions: number;
  deletions: number;
  diffLines: Array<{
    type: 'add' | 'delete' | 'unchanged';
    content: string;
    lineNumber: number;
  }>;
}

// ─── Plugins Domain ──────────────────────────────────────────────────────────

export interface PluginInstallRequest {
  source: string;
  type: 'mcp-server' | 'transformer' | 'integration';
  name?: string;
}

export interface PluginInstallResponse {
  success: boolean;
  pluginId: string;
  name: string;
  version: string;
  capabilities: string[];
  error?: string;
}

export interface PluginUninstallRequest {
  pluginId: string;
  force: boolean;
}

export interface PluginUninstallResponse {
  success: boolean;
  dependentInterfaces?: string[];
  error?: string;
}

export interface PluginListResponse {
  plugins: Array<{
    id: string;
    name: string;
    type: string;
    version: string;
    status: string;
    capabilities: string[];
    installedAt: string;
  }>;
}

export interface PluginStatusChangedEvent {
  pluginId: string;
  status: 'installed' | 'installing' | 'error' | 'uninstalling';
  progress?: number;
  error?: string;
}

// ─── App Domain ──────────────────────────────────────────────────────────────

export interface CompileCodeRequest {
  sourceCode: string;
  format: 'iife';
  target: 'es2020';
  minify: boolean;
}

export interface CompileCodeResponse {
  success: boolean;
  compiledCode?: string;
  errors?: Array<{ message: string; line?: number; column?: number }>;
  warnings?: string[];
  bundleSizeBytes?: number;
}

export interface ValidateCodeRequest {
  code: string;
}

export interface ValidateCodeResponse {
  valid: boolean;
  violations: Array<{
    pattern: string;
    instances: number;
    severity: 'error' | 'warning';
  }>;
}

// ─── Full Bridge Interface ────────────────────────────────────────────────────

export interface ExperienceUIBridge {
  cli: {
    sendMessage(request: CLISendMessageRequest): Promise<CLISendMessageResponse>;
    getStatus(): Promise<CLIStatusResponse>;
    restart(): Promise<CLIRestartResponse>;
    onStatusChanged(callback: (event: CLIStatusChangedEvent) => void): () => void;
    onStreamResponse(callback: (event: CLIStreamResponseEvent) => void): () => void;
  };
  auth: {
    configure(request: AuthConfigureRequest): Promise<AuthConfigureResponse>;
    testConnection(request: AuthTestRequest): Promise<AuthTestResponse>;
    getConnectionStatus(request: AuthStatusRequest): Promise<AuthStatusResponse>;
    startOAuthFlow(request: OAuthFlowRequest): Promise<OAuthFlowResponse>;
    clearCredentials(request: AuthClearRequest): Promise<AuthClearResponse>;
    onTokenExpired(callback: (event: TokenExpiredEvent) => void): () => void;
    onTokenRefreshed(callback: (event: TokenRefreshedEvent) => void): () => void;
    onConnectionStatusChanged(
      callback: (event: ConnectionStatusChangedEvent) => void,
    ): () => void;
  };
  proxy: {
    apiRequest(request: ProxyAPIRequest): Promise<ProxyAPIResponse>;
  };
  versions: {
    saveSnapshot(request: VersionSaveRequest): Promise<VersionSaveResponse>;
    list(request: VersionListRequest): Promise<VersionListResponse>;
    loadCode(request: VersionLoadRequest): Promise<VersionLoadResponse>;
    getDiff(request: VersionDiffRequest): Promise<VersionDiffResponse>;
  };
  plugins: {
    install(request: PluginInstallRequest): Promise<PluginInstallResponse>;
    uninstall(request: PluginUninstallRequest): Promise<PluginUninstallResponse>;
    list(): Promise<PluginListResponse>;
    onStatusChanged(callback: (event: PluginStatusChangedEvent) => void): () => void;
  };
  app: {
    getVersion(): Promise<string>;
    compileCode(request: CompileCodeRequest): Promise<CompileCodeResponse>;
    validateCode(request: ValidateCodeRequest): Promise<ValidateCodeResponse>;
  };
}

// ─── Global Window Augmentation ──────────────────────────────────────────────

declare global {
  interface Window {
    experienceUI: ExperienceUIBridge;
  }
}
