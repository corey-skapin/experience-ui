import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import * as esbuild from 'esbuild';
import {
  IPC_CLI_SEND_MESSAGE,
  IPC_CLI_GET_STATUS,
  IPC_CLI_RESTART,
  IPC_CLI_STATUS_CHANGED,
  IPC_CLI_STREAM_RESPONSE,
  IPC_APP_COMPILE_CODE,
  IPC_APP_VALIDATE_CODE,
  IPC_PROXY_API_REQUEST,
} from '@shared/ipc-channels';
import { DISALLOWED_CODE_PATTERNS } from '@shared/constants';
import { CLIManager } from './cli/cli-manager';
import { registerProxyHandler } from './proxy/api-proxy';

const cliManager = new CLIManager();

function createWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 768,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  cliManager.on('statusChanged', (status: unknown) => {
    mainWindow.webContents.send(IPC_CLI_STATUS_CHANGED, status);
  });

  cliManager.on('notification', (notification: unknown) => {
    mainWindow.webContents.send(IPC_CLI_STREAM_RESPONSE, notification);
  });

  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  return mainWindow;
}

function registerIpcHandlers(): void {
  ipcMain.handle(IPC_CLI_SEND_MESSAGE, async (_event, request: unknown) => {
    const req = request as { method: string; params?: Record<string, unknown> };
    return cliManager.sendRequest(req.method, req.params);
  });

  ipcMain.handle(IPC_CLI_GET_STATUS, () => cliManager.getStatus());

  ipcMain.handle(IPC_CLI_RESTART, async () => {
    await cliManager.restart();
    return cliManager.getStatus();
  });

  ipcMain.handle(IPC_APP_COMPILE_CODE, async (_event, request: unknown) => {
    const req = request as { code: string };
    try {
      const result = await esbuild.transform(req.code, {
        format: 'iife',
        target: 'es2020',
        loader: 'tsx',
        jsxFactory: 'React.createElement',
        jsxFragment: 'React.Fragment',
      });
      return { success: true, code: result.code };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, errors: [{ message }] };
    }
  });

  ipcMain.handle(IPC_APP_VALIDATE_CODE, (_event, request: unknown) => {
    const req = request as { code: string };
    const violations: Array<{
      pattern: string;
      severity: string;
      instances: number;
      description: string;
    }> = [];
    for (const entry of DISALLOWED_CODE_PATTERNS) {
      entry.regex.lastIndex = 0;
      const matches = req.code.match(entry.regex);
      entry.regex.lastIndex = 0;
      if (matches && matches.length > 0) {
        violations.push({
          pattern: entry.pattern,
          severity: entry.severity,
          instances: matches.length,
          description: entry.description,
        });
      }
    }
    return { valid: violations.length === 0, violations };
  });

  registerProxyHandler(ipcMain, IPC_PROXY_API_REQUEST);
}

app.whenReady().then(() => {
  registerIpcHandlers();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
