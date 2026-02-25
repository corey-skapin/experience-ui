# Contract: Electron IPC Channels

**Feature Branch**: `001-api-ui-generator`
**Boundary**: Electron Main Process ↔ Renderer Process
**Protocol**: Electron `ipcMain.handle()` / `ipcRenderer.invoke()` (request/response) and `webContents.send()` / `ipcRenderer.on()` (push notifications)

---

## Overview

The Electron main process manages privileged operations (CLI subprocess, credential storage, file system, network proxy). The renderer process (React app) communicates with main exclusively via typed IPC channels exposed through a `contextBridge` preload script.

## Security Constraints

- **Context isolation**: `contextIsolation: true` — renderer has no direct access to Node.js or Electron APIs
- **No node integration**: `nodeIntegration: false` — renderer cannot `require()` Node modules
- **Preload allowlist**: Only explicitly exposed methods are available to renderer
- **Input validation**: Main process MUST validate all IPC arguments before processing
- **No credential exposure**: Credential values MUST NOT be sent to renderer; only opaque references and status

---

## Channel Naming Convention

```text
{domain}:{action}
```

Domains: `cli`, `auth`, `proxy`, `versions`, `plugins`, `app`

---

## Request/Response Channels (invoke/handle)

### CLI Domain

#### `cli:send-message`
Send a message to the Copilot CLI subprocess.

```typescript
// Renderer → Main
interface CLISendMessageRequest {
  message: string;
  context?: {
    tabId: string;
    activeSpecId?: string;
    activeVersionId?: string;
  };
}

// Main → Renderer (response)
interface CLISendMessageResponse {
  success: boolean;
  response?: string;
  error?: string;
  requestId: string;
}
```

#### `cli:get-status`
Get current CLI subprocess status.

```typescript
// No request payload

// Main → Renderer (response)
interface CLIStatusResponse {
  status: 'stopped' | 'starting' | 'running' | 'crashed' | 'restarting';
  pid: number | null;
  restartCount: number;
  pendingRequests: number;
  uptime: number | null;     // milliseconds
}
```

#### `cli:restart`
Force restart the CLI subprocess.

```typescript
// No request payload

// Main → Renderer (response)
interface CLIRestartResponse {
  success: boolean;
  error?: string;
}
```

---

### Auth Domain

#### `auth:configure`
Set up authentication for an API base URL.

```typescript
// Renderer → Main
interface AuthConfigureRequest {
  baseUrl: string;
  method: 
    | { type: 'apiKey'; headerName: string; key: string }
    | { type: 'bearer'; token: string }
    | { type: 'oauth2'; clientId: string; authEndpoint: string; tokenEndpoint: string; scopes: string[] };
  persist: boolean;          // Whether to save to OS keychain
}

// Main → Renderer (response)
interface AuthConfigureResponse {
  success: boolean;
  connectionId: string;
  error?: string;
}
```

#### `auth:test-connection`
Test API connectivity with current credentials.

```typescript
// Renderer → Main
interface AuthTestRequest {
  baseUrl: string;
  healthCheckPath?: string;  // Default: '/' or '/health'
}

// Main → Renderer (response)
interface AuthTestResponse {
  // Note: 'unauthorized' here is a test result status, mapped to 'expired' in the ConnectionStatus state model
  status: 'connected' | 'degraded' | 'unreachable' | 'unauthorized';
  responseTimeMs: number;
  statusCode?: number;
  error?: string;
}
```

#### `auth:get-connection-status`
Get current connection status for a base URL.

```typescript
// Renderer → Main
interface AuthStatusRequest {
  baseUrl: string;
}

// Main → Renderer (response)
interface AuthStatusResponse {
  configured: boolean;
  status: 'disconnected' | 'connected' | 'degraded' | 'expired' | 'unreachable';
  authMethod: 'apiKey' | 'bearer' | 'oauth2' | 'none';
  lastVerifiedAt: string | null;  // ISO 8601
  responseTimeMs: number | null;
}
```

#### `auth:start-oauth-flow`
Initiate OAuth 2.0 PKCE flow in a dedicated browser window.

```typescript
// Renderer → Main
interface OAuthFlowRequest {
  baseUrl: string;
  clientId: string;
  authEndpoint: string;
  tokenEndpoint: string;
  scopes: string[];
  redirectUri?: string;
}

// Main → Renderer (response)
interface OAuthFlowResponse {
  success: boolean;
  connectionId?: string;
  error?: string;
}
```

#### `auth:clear-credentials`
Remove stored credentials for a base URL.

```typescript
// Renderer → Main
interface AuthClearRequest {
  baseUrl: string;
  clearPersisted: boolean;   // Also remove from OS keychain
}

// Main → Renderer (response)
interface AuthClearResponse {
  success: boolean;
}
```

---

### Proxy Domain

#### `proxy:api-request`
Proxy an API request through the main process (used by sandbox network proxy).

```typescript
// Renderer → Main
interface ProxyAPIRequest {
  baseUrl: string;
  path: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
  timeout?: number;          // Default: 30000ms
}

// Main → Renderer (response)
interface ProxyAPIResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  elapsedMs: number;
}
```

---

### Versions Domain

#### `versions:save-snapshot`
Save a new interface version to disk.

```typescript
// Renderer → Main
interface VersionSaveRequest {
  interfaceId: string;
  generatedCode: string;
  description: string;
  changeType: 'generation' | 'customization' | 'rollback';
  generationPrompt?: string;
  parentVersionId?: string;
  revertedFromVersionId?: string;
  pluginDependencies?: string[];
}

// Main → Renderer (response)
interface VersionSaveResponse {
  success: boolean;
  versionId: string;
  versionNumber: number;
  codePath: string;
  codeHash: string;
}
```

#### `versions:list`
List all versions for an interface.

```typescript
// Renderer → Main
interface VersionListRequest {
  interfaceId: string;
  page?: number;             // Default: 1
  pageSize?: number;         // Default: 50
}

// Main → Renderer (response)
interface VersionListResponse {
  versions: Array<{
    id: string;
    versionNumber: number;
    parentVersionId: string | null;
    changeType: string;
    description: string;
    isRevert: boolean;
    createdAt: string;       // ISO 8601
  }>;
  totalCount: number;
  page: number;
  pageSize: number;
}
```

#### `versions:load-code`
Load generated code for a specific version.

```typescript
// Renderer → Main
interface VersionLoadRequest {
  interfaceId: string;
  versionId: string;
}

// Main → Renderer (response)
interface VersionLoadResponse {
  code: string;
  codeHash: string;
  versionNumber: number;
}
```

#### `versions:get-diff`
Get a diff between two versions.

```typescript
// Renderer → Main
interface VersionDiffRequest {
  interfaceId: string;
  fromVersionId: string;
  toVersionId: string;
}

// Main → Renderer (response)
interface VersionDiffResponse {
  additions: number;
  deletions: number;
  diffLines: Array<{
    type: 'add' | 'delete' | 'unchanged';
    content: string;
    lineNumber: number;
  }>;
}
```

---

### Plugins Domain

#### `plugins:install`
Install a tool/plugin.

```typescript
// Renderer → Main
interface PluginInstallRequest {
  source: string;            // Package reference, path, or URL
  type: 'mcp-server' | 'transformer' | 'integration';
  name?: string;             // Optional display name override
}

// Main → Renderer (response)
interface PluginInstallResponse {
  success: boolean;
  pluginId: string;
  name: string;
  version: string;
  capabilities: string[];
  error?: string;
}
```

#### `plugins:uninstall`
Uninstall a plugin.

```typescript
// Renderer → Main
interface PluginUninstallRequest {
  pluginId: string;
  force: boolean;            // Skip dependent interface warning
}

// Main → Renderer (response)
interface PluginUninstallResponse {
  success: boolean;
  dependentInterfaces?: string[];  // Affected interfaces (if force=false and deps exist)
  error?: string;
}
```

#### `plugins:list`
List all installed plugins.

```typescript
// No request payload

// Main → Renderer (response)
interface PluginListResponse {
  plugins: Array<{
    id: string;
    name: string;
    type: string;
    version: string;
    status: string;
    capabilities: string[];
    installedAt: string;     // ISO 8601
  }>;
}
```

---

### App Domain

#### `app:compile-code`
Compile generated React/JSX code via esbuild.

```typescript
// Renderer → Main
interface CompileCodeRequest {
  sourceCode: string;
  format: 'iife';
  target: 'es2020';
  minify: boolean;
}

// Main → Renderer (response)
interface CompileCodeResponse {
  success: boolean;
  compiledCode?: string;
  errors?: Array<{ message: string; line?: number; column?: number }>;
  warnings?: string[];
  bundleSizeBytes?: number;
}
```

#### `app:validate-code`
Validate generated code for disallowed patterns before sandbox injection.

```typescript
// Renderer → Main
interface ValidateCodeRequest {
  code: string;
}

// Main → Renderer (response)
interface ValidateCodeResponse {
  valid: boolean;
  violations: Array<{
    pattern: string;
    instances: number;
    severity: 'error' | 'warning';
  }>;
}
```

---

## Push Notification Channels (send/on)

These are one-way notifications from main process to renderer.

#### `cli:status-changed`
CLI subprocess status has changed.

```typescript
interface CLIStatusChangedEvent {
  status: 'stopped' | 'starting' | 'running' | 'crashed' | 'restarting';
  message?: string;
}
```

#### `cli:stream-response`
Streaming response chunk from CLI (for real-time chat display).

```typescript
interface CLIStreamResponseEvent {
  requestId: string;
  chunk: string;
  done: boolean;
}
```

#### `auth:token-expired`
Credentials for a base URL have expired.

```typescript
interface TokenExpiredEvent {
  baseUrl: string;
  reason: 'expired' | 'revoked' | 'invalid';
}
```

#### `auth:token-refreshed`
Credentials were automatically refreshed.

```typescript
interface TokenRefreshedEvent {
  baseUrl: string;
}
```

#### `auth:connection-status-changed`
Connection status for a base URL has changed.

```typescript
interface ConnectionStatusChangedEvent {
  baseUrl: string;
  status: 'connected' | 'degraded' | 'unreachable' | 'expired';
  responseTimeMs?: number;
}
```

#### `plugins:status-changed`
Plugin installation/lifecycle status changed.

```typescript
interface PluginStatusChangedEvent {
  pluginId: string;
  status: 'installed' | 'installing' | 'error' | 'uninstalling';
  progress?: number;         // 0-100 for installation progress
  error?: string;
}
```

---

## Preload API Surface

The `contextBridge` exposes these methods to the renderer:

```typescript
interface ExperienceUIBridge {
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
    onConnectionStatusChanged(callback: (event: ConnectionStatusChangedEvent) => void): () => void;
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
    compileCode(request: CompileCodeRequest): Promise<CompileCodeResponse>;
    validateCode(request: ValidateCodeRequest): Promise<ValidateCodeResponse>;
  };
}

// Available in renderer as:
declare global {
  interface Window {
    experienceUI: ExperienceUIBridge;
  }
}
```
