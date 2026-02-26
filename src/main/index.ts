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
  IPC_CLI_GET_STATUS,
  IPC_CLI_RESTART,
  IPC_CLI_SEND_MESSAGE,
  IPC_CLI_STATUS_CHANGED,
  IPC_CLI_STREAM_RESPONSE,
} from '../shared/ipc-channels';
import { DISALLOWED_CODE_PATTERNS } from '../shared/constants';
import type {
  CLISendMessageRequest,
  CLIStatusChangedEvent,
  CLIStreamResponseEvent,
  CompileCodeRequest,
  ValidateCodeRequest,
} from './preload-types';
import { CLIManager, type StreamChunkEvent } from './cli/cli-manager';
import type { CLIState } from '../shared/types';

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
