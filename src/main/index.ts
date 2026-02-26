// src/main/index.ts
// Electron main process entry point.
// Manages BrowserWindow lifecycle with security-first configuration:
//   - contextIsolation: true (renderer cannot access Node.js APIs directly)
//   - nodeIntegration: false (prevents renderer from requiring Node modules)
//   - sandbox: true (additional process-level sandboxing)
//   - preload script bridges the gap via contextBridge
//
// IPC handlers for CLI, auth, proxy, versions, plugins, and app domains
// will be registered here in subsequent implementation tasks (T010, T023-T024,
// T047, T068, etc.).
import { join } from 'path';

import { app, BrowserWindow, shell } from 'electron';

// Prevent multiple instances of the app
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
}

function createWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    show: false, // Defer show until ready-to-show to avoid white flash
    autoHideMenuBar: true,
    webPreferences: {
      // Security-critical: isolate renderer from Node.js
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      // Preload script exposes a typed, minimal surface via contextBridge
      preload: join(__dirname, '../preload/index.js'),
      // Disallow navigation to external origins
      navigateOnDragDrop: false,
    },
  });

  // Show window gracefully once content is ready
  mainWindow.on('ready-to-show', () => {
    mainWindow.show();
  });

  // Open external links in the system browser, not in Electron
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Load renderer: dev server in development, built file in production
  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }

  return mainWindow;
}

// App lifecycle
app.whenReady().then(() => {
  createWindow();

  // macOS: re-create window when dock icon is clicked and no windows are open
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed (except on macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
