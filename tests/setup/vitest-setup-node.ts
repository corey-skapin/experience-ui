/**
 * Vitest setup file for main process tests (Node.js environment).
 * Configures mocks for Electron APIs and Node.js built-ins.
 */
import { vi } from 'vitest'

// Mock electron module for main process unit tests
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn((name: string) => `/tmp/test-${name}`),
    getVersion: vi.fn(() => '0.1.0'),
    quit: vi.fn(),
    on: vi.fn(),
    whenReady: vi.fn(() => Promise.resolve()),
  },
  ipcMain: {
    handle: vi.fn(),
    on: vi.fn(),
    removeHandler: vi.fn(),
  },
  BrowserWindow: vi.fn().mockImplementation(() => ({
    loadURL: vi.fn(),
    loadFile: vi.fn(),
    webContents: {
      send: vi.fn(),
      openDevTools: vi.fn(),
    },
    on: vi.fn(),
    show: vi.fn(),
    close: vi.fn(),
  })),
  contextBridge: {
    exposeInMainWorld: vi.fn(),
  },
  shell: {
    openExternal: vi.fn(),
  },
  dialog: {
    showOpenDialog: vi.fn(),
    showSaveDialog: vi.fn(),
    showMessageBox: vi.fn(),
  },
  nativeTheme: {
    shouldUseDarkColors: false,
    on: vi.fn(),
  },
}))
