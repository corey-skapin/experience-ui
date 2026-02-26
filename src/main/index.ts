import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import {
  IPC_CLI_GET_STATUS,
  IPC_APP_COMPILE_CODE,
  IPC_APP_VALIDATE_CODE,
} from '@shared/ipc-channels';

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

  // In dev, load from vite dev server; in prod, load from built files
  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  return mainWindow;
}

function registerIpcHandlers(): void {
  ipcMain.handle(IPC_CLI_GET_STATUS, () => ({
    status: 'stopped',
    pid: null,
    restartCount: 0,
    pendingRequests: 0,
    uptime: null,
  }));

  ipcMain.handle(IPC_APP_COMPILE_CODE, (_event, _request) => {
    // Stub — full implementation in T024
    return { success: false, errors: [{ message: 'Not implemented' }] };
  });

  ipcMain.handle(IPC_APP_VALIDATE_CODE, (_event, _request) => {
    // Stub — full implementation in T024
    return { valid: true, violations: [] };
  });
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
