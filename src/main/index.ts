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

import { app, BrowserWindow, shell } from 'electron';

// Prevent multiple instances of the app
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
}

let mainWindow: BrowserWindow | null = null;

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
  mainWindow = createWindow();

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
