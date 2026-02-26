// src/main/index.ts
// Electron main process entry point (T010).
// Manages BrowserWindow lifecycle with security-first configuration:
//   - contextIsolation: true (renderer cannot access Node.js APIs directly)
//   - nodeIntegration: false (prevents renderer from requiring Node modules)
//   - sandbox: true (additional process-level sandboxing)
//   - preload script bridges the gap via contextBridge
//
// IPC handlers for CLI, auth, proxy, versions, plugins, and app domains
// are registered in subsequent implementation tasks (T023-T024, T047, T068).
import { join } from 'path';

import { app, BrowserWindow, ipcMain, shell } from 'electron';
import * as esbuild from 'esbuild';

import {
  IPC_APP_COMPILE_CODE,
  IPC_APP_GET_VERSION,
  IPC_APP_VALIDATE_CODE,
  IPC_AUTH_CLEAR_CREDENTIALS,
  IPC_AUTH_CONFIGURE,
  IPC_AUTH_GET_CONNECTION_STATUS,
  IPC_AUTH_START_OAUTH_FLOW,
  IPC_AUTH_TEST_CONNECTION,
  IPC_CLI_GET_STATUS,
  IPC_CLI_RESTART,
  IPC_CLI_SEND_MESSAGE,
  IPC_CLI_STATUS_CHANGED,
  IPC_CLI_STREAM_RESPONSE,
} from '../shared/ipc-channels';
import { DISALLOWED_CODE_PATTERNS, HEALTH_CHECK_TIMEOUT_MS } from '../shared/constants';
import type {
  AuthConfigureRequest,
  AuthClearRequest,
  AuthStatusRequest,
  AuthTestRequest,
  CLISendMessageRequest,
  CLIStatusChangedEvent,
  CLIStreamResponseEvent,
  CompileCodeRequest,
  OAuthFlowRequest,
  ValidateCodeRequest,
} from './preload-types';
import { CLIManager, type StreamChunkEvent } from './cli/cli-manager';
import type { CLIState } from '../shared/types';
import { credentialStore } from './credentials/credential-store';
import { OAuthFlow } from './credentials/oauth-flow';
import { registerApiProxy } from './proxy/api-proxy';

// Prevent multiple instances of the app
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
}

let mainWindow: BrowserWindow | null = null;

// ─── CLI Manager Singleton ────────────────────────────────────────────────────

const cliManager = new CLIManager({
  cliPath: process.env['COPILOT_CLI_PATH'] ?? 'copilot-cli',
});

// Pre-compile global-flag RegExps for code validation (avoids per-call RegExp construction).
const VALIDATION_PATTERNS = DISALLOWED_CODE_PATTERNS.map((entry) => ({
  regex: new RegExp(entry.pattern.source, 'g'),
  description: entry.description,
  severity: entry.severity,
}));

// ─── IPC Handler Registration ─────────────────────────────────────────────────

function registerIpcHandlers(): void {
  // ── T023: CLI Domain ───────────────────────────────────────────────────────

  ipcMain.handle(IPC_CLI_SEND_MESSAGE, async (_event, req: CLISendMessageRequest) => {
    try {
      const response = await cliManager.send('chat', {
        message: req.message,
        context: req.context,
      });
      return { success: true, response, requestId: String(Date.now()) };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
        requestId: String(Date.now()),
      };
    }
  });

  ipcMain.handle(IPC_CLI_GET_STATUS, () => {
    const state = cliManager.getState();
    return {
      status: state.status,
      pid: state.pid,
      restartCount: state.restartCount,
      pendingRequests: state.pendingRequests,
      uptime: null,
    };
  });

  ipcMain.handle(IPC_CLI_RESTART, async () => {
    try {
      cliManager.restart();
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  // ── T047: Auth Domain ──────────────────────────────────────────────────────

  const oauthFlow = new OAuthFlow(credentialStore);

  ipcMain.handle(IPC_AUTH_CONFIGURE, async (_event, req: AuthConfigureRequest) => {
    try {
      const method = req.method;
      // OAuth2 setup must go through the interactive flow — not stored as raw creds
      if (method.type === 'oauth2') {
        return oauthFlow.startFlow({
          baseUrl: req.baseUrl,
          clientId: method.clientId,
          authEndpoint: method.authEndpoint,
          tokenEndpoint: method.tokenEndpoint,
          scopes: method.scopes,
        });
      }
      // apiKey and bearer can be stored directly
      credentialStore.set(req.baseUrl, method, { persist: req.persist });
      const ref = credentialStore.get(req.baseUrl);
      return { success: true, connectionId: ref?.connectionId ?? '' };
    } catch (err) {
      return {
        success: false,
        connectionId: '',
        error: err instanceof Error ? err.message : String(err),
      };
    }
  });

  ipcMain.handle(IPC_AUTH_TEST_CONNECTION, async (_event, req: AuthTestRequest) => {
    const healthPath = req.healthCheckPath ?? '/';
    const url = `${req.baseUrl}${healthPath}`;
    const start = Date.now();
    try {
      const raw = credentialStore.getRaw(req.baseUrl);
      const headers: Record<string, string> = {};
      if (raw?.type === 'apiKey') headers[raw.headerName] = raw.key;
      else if (raw?.type === 'bearer') headers['Authorization'] = `Bearer ${raw.token}`;
      else if (raw?.type === 'oauth2') headers['Authorization'] = `Bearer ${raw.accessToken}`;

      const res = await fetch(url, {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(HEALTH_CHECK_TIMEOUT_MS),
      });
      const responseTimeMs = Date.now() - start;

      if (res.status === 401)
        return { status: 'unauthorized', responseTimeMs, statusCode: res.status };
      if (res.ok) return { status: 'connected', responseTimeMs, statusCode: res.status };
      return { status: 'degraded', responseTimeMs, statusCode: res.status };
    } catch (err) {
      return {
        status: 'unreachable',
        responseTimeMs: Date.now() - start,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  });

  ipcMain.handle(IPC_AUTH_GET_CONNECTION_STATUS, (_event, req: AuthStatusRequest) => {
    const raw = credentialStore.getRaw(req.baseUrl);
    if (!raw)
      return {
        configured: false,
        status: 'disconnected',
        authMethod: 'none',
        lastVerifiedAt: null,
        responseTimeMs: null,
      };
    return {
      configured: true,
      status: 'connected',
      authMethod: raw.type,
      lastVerifiedAt: null,
      responseTimeMs: null,
    };
  });

  ipcMain.handle(IPC_AUTH_CLEAR_CREDENTIALS, async (_event, req: AuthClearRequest) => {
    credentialStore.clear(req.baseUrl, req.clearPersisted);
    return { success: true };
  });

  ipcMain.handle(IPC_AUTH_START_OAUTH_FLOW, async (_event, req: OAuthFlowRequest) => {
    return oauthFlow.startFlow(req);
  });

  // ── T047: Proxy Domain ─────────────────────────────────────────────────────

  registerApiProxy(credentialStore, () => mainWindow);

  // ── T024: App Domain ───────────────────────────────────────────────────────

  ipcMain.handle(IPC_APP_GET_VERSION, () => app.getVersion());

  ipcMain.handle(IPC_APP_COMPILE_CODE, async (_event, req: CompileCodeRequest) => {
    try {
      const result = await esbuild.transform(req.sourceCode, {
        format: req.format,
        target: req.target,
        minify: req.minify,
        loader: 'tsx',
      });
      return {
        success: true,
        compiledCode: result.code,
        warnings: result.warnings.map((w) => w.text),
        bundleSizeBytes: Buffer.byteLength(result.code, 'utf8'),
      };
    } catch (err) {
      const errors = err instanceof Error ? [{ message: err.message }] : [{ message: String(err) }];
      return { success: false, errors };
    }
  });

  ipcMain.handle(IPC_APP_VALIDATE_CODE, (_event, req: ValidateCodeRequest) => {
    const violations: Array<{ pattern: string; instances: number; severity: 'error' | 'warning' }> =
      [];

    for (const entry of VALIDATION_PATTERNS) {
      // Reset lastIndex since we reuse the same RegExp instance
      entry.regex.lastIndex = 0;
      const matches = req.code.match(entry.regex);
      if (matches && matches.length > 0) {
        violations.push({
          pattern: entry.description,
          instances: matches.length,
          severity: entry.severity,
        });
      }
    }

    return { valid: violations.length === 0, violations };
  });
}

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    // Defer show until ready-to-show to avoid white flash
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      // Security-critical: isolate renderer from Node.js
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      // Preload script exposes a typed, minimal surface via contextBridge
      preload: join(__dirname, '../preload/index.js'),
      // Disallow navigation to external origins via drag-and-drop
      navigateOnDragDrop: false,
    },
  });

  // Show window gracefully once content is ready
  win.on('ready-to-show', () => {
    win.show();
  });

  // Open external links in the system browser, not in Electron
  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  // Load renderer: dev server in development, built file in production
  if (process.env['ELECTRON_RENDERER_URL']) {
    void win.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'));
  }

  return win;
}

// App lifecycle
app.whenReady().then(() => {
  registerIpcHandlers();
  mainWindow = createWindow();

  // ── CLI push notifications ────────────────────────────────────────────────

  cliManager.on('state-changed', (state: CLIState) => {
    const event: CLIStatusChangedEvent = {
      status: state.status,
      message: state.errorMessage ?? undefined,
    };
    mainWindow?.webContents.send(IPC_CLI_STATUS_CHANGED, event);
  });

  cliManager.on('stream-chunk', (event: StreamChunkEvent) => {
    const payload: CLIStreamResponseEvent = {
      requestId: String(event.requestId),
      chunk: event.chunk,
      done: event.done,
    };
    mainWindow?.webContents.send(IPC_CLI_STREAM_RESPONSE, payload);
  });

  // ── Auth health checks (T055) ────────────────────────────────────────────

  if (mainWindow) {
    credentialStore.startHealthChecks(mainWindow);
  }

  // Subscribe to auth push events emitted by health checks
  // These are emitted via credentialStore.startHealthChecks → mainWindow.webContents.send
  // The preload bridge re-emits them to the renderer via onTokenExpired /
  // onConnectionStatusChanged subscriptions already wired in preload.ts.

  // macOS: re-create window when dock icon is clicked and no windows are open
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow();
    }
  });
});

// Handle second instance — focus existing window
app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

// Quit when all windows are closed (except on macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
