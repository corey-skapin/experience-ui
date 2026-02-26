/**
 * Electron main process entry point.
 * Creates the BrowserWindow with security hardening and loads the renderer.
 * Registers IPC handlers for CLI, app domain (compile/validate), and proxy.
 */
import { app, BrowserWindow, shell, ipcMain } from 'electron'
import { join } from 'path'
import { transform } from 'esbuild'
import { CLI_CHANNELS, APP_CHANNELS, PROXY_CHANNELS, AUTH_CHANNELS } from '../shared/ipc-channels'
import { ESBUILD, DISALLOWED_CODE_PATTERNS } from '../shared/constants'
import { CLIManager } from './cli/cli-manager'
import { handleProxyRequest } from './proxy/api-proxy'
import { CredentialStore } from './credentials/credential-store'
import type { KeytarProvider, KeytarLike, RawCredential } from './credentials/credential-store'
import { registerOAuthHandler } from './credentials/oauth-flow'
import type {
  AuthConfigureRequest,
  AuthTestRequest,
  AuthStatusRequest,
  AuthClearRequest,
} from '../shared/types/ipc'

const isDev = process.env.NODE_ENV === 'development'

let mainWindow: BrowserWindow | null = null

// ─── CLI subprocess ───────────────────────────────────────────────────────

// CLI path — points to the copilot-cli binary in resources
const cliPath = isDev
  ? join(__dirname, '../../resources/cli/copilot-cli')
  : join(process.resourcesPath, 'cli/copilot-cli')

const cliManager = new CLIManager(cliPath)

// ─── Credential store ──────────────────────────────────────────────────────

const keytarProvider: KeytarProvider = async () => {
  return require('keytar') as KeytarLike
}
export const credentialStore = new CredentialStore(keytarProvider)

// ─── Code validator (inline, main-process copy) ───────────────────────────

function validateCodeMain(code: string): {
  safe: boolean
  violations: { pattern: string; count: number; severity: 'error' | 'warning' }[]
  violationCount: number
} {
  const violations: { pattern: string; count: number; severity: 'error' | 'warning' }[] = []

  for (const pattern of DISALLOWED_CODE_PATTERNS) {
    let count = 0
    let index = 0
    while ((index = code.indexOf(pattern, index)) !== -1) {
      count++
      index += pattern.length
    }
    if (count > 0) {
      violations.push({ pattern, count, severity: 'error' })
    }
  }

  return {
    safe: violations.length === 0,
    violations,
    violationCount: violations.reduce((s, v) => s + v.count, 0),
  }
}

// ─── IPC handlers ──────────────────────────────────────────────────────────

function registerIpcHandlers(): void {
  // ── CLI handlers (T023) ───────────────────────────────────────────────

  ipcMain.handle(
    CLI_CHANNELS.SEND_MESSAGE,
    async (_event, req: { message: string; context?: Record<string, unknown> }) => {
      try {
        const requestId = String(Date.now())
        const result = await cliManager.send('chat', { message: req.message, context: req.context })
        return { success: true, response: JSON.stringify(result), requestId }
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : String(err),
          requestId: '',
        }
      }
    },
  )

  ipcMain.handle(CLI_CHANNELS.GET_STATUS, () => {
    const state = cliManager.getState()
    return {
      status: state.status,
      pid: state.pid,
      restartCount: state.restartCount,
      pendingRequests: state.pendingRequests,
      uptime: state.uptime,
    }
  })

  ipcMain.handle(CLI_CHANNELS.RESTART, async () => {
    try {
      await cliManager.restart()
      return { success: true }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  })

  // ── App handlers (T024) ────────────────────────────────────────────────

  ipcMain.handle(APP_CHANNELS.COMPILE_CODE, async (_event, req: { code: string }) => {
    try {
      const result = await transform(req.code, {
        format: ESBUILD.FORMAT,
        target: ESBUILD.TARGET,
        loader: 'tsx',
        jsx: 'automatic',
        minify: false,
      })
      return { success: true, compiledCode: result.code }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  })

  ipcMain.handle(APP_CHANNELS.VALIDATE_CODE, (_event, req: { code: string }) => {
    return validateCodeMain(req.code)
  })

  // ── Proxy handler (T040) ───────────────────────────────────────────────

  ipcMain.handle(PROXY_CHANNELS.API_REQUEST, async (_event, req) => {
    return handleProxyRequest(req as Parameters<typeof handleProxyRequest>[0], credentialStore)
  })

  // ── Auth handlers (T047) ───────────────────────────────────────────────

  ipcMain.handle(AUTH_CHANNELS.CONFIGURE, async (_event, req: AuthConfigureRequest) => {
    try {
      const { baseUrl, method, persist } = req
      let rawCredential: RawCredential

      if (method.type === 'apiKey') {
        rawCredential = { type: 'apiKey', headerName: method.headerName, key: method.key }
      } else if (method.type === 'bearer') {
        rawCredential = { type: 'bearer', token: method.token }
      } else {
        rawCredential = { type: 'oauth2', accessToken: '' }
      }

      const connectionId = credentialStore.setCredentials(baseUrl, rawCredential, { persist })
      return { success: true, connectionId }
    } catch (err) {
      return {
        success: false,
        connectionId: '',
        error: err instanceof Error ? err.message : String(err),
      }
    }
  })

  ipcMain.handle(AUTH_CHANNELS.TEST_CONNECTION, async (_event, req: AuthTestRequest) => {
    const startTime = Date.now()
    const url = `${req.baseUrl}${req.healthCheckPath ?? '/'}`
    try {
      const headers = credentialStore.getAuthHeaders(req.baseUrl)
      const response = await fetch(url, {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(10_000),
      })
      const responseTimeMs = Date.now() - startTime
      if (response.status === 401 || response.status === 403) {
        return { status: 'unauthorized', responseTimeMs, statusCode: response.status }
      }
      if (response.ok) {
        return { status: 'connected', responseTimeMs, statusCode: response.status }
      }
      return { status: 'degraded', responseTimeMs, statusCode: response.status }
    } catch {
      return { status: 'unreachable', responseTimeMs: Date.now() - startTime }
    }
  })

  ipcMain.handle(AUTH_CHANNELS.GET_CONNECTION_STATUS, (_event, req: AuthStatusRequest) => {
    const configured = credentialStore.hasCredentials(req.baseUrl)
    return {
      configured,
      status: configured ? 'connected' : 'disconnected',
      authMethod: 'none',
      lastVerifiedAt: null,
      responseTimeMs: null,
    }
  })

  ipcMain.handle(AUTH_CHANNELS.CLEAR_CREDENTIALS, (_event, req: AuthClearRequest) => {
    credentialStore.clearCredentials(req.baseUrl, { clearPersisted: req.clearPersisted })
    return { success: true }
  })

  registerOAuthHandler(credentialStore)
}

// ─── CLI event forwarding ──────────────────────────────────────────────────

function setupCLINotifications(): void {
  cliManager.on('statusChanged', (state: ReturnType<CLIManager['getState']>) => {
    mainWindow?.webContents.send(CLI_CHANNELS.STATUS_CHANGED, state)
  })
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 768,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  })

  // Gracefully show window after content is ready (prevents white flash)
  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  // Open external links in the OS default browser, not in the app
  mainWindow.webContents.setWindowOpenHandler((details) => {
    void shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    void mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  if (isDev) {
    mainWindow.webContents.openDevTools()
  }
}

app.whenReady().then(() => {
  registerIpcHandlers()
  setupCLINotifications()
  createWindow()
  credentialStore.startHealthChecks((baseUrl) => {
    mainWindow?.webContents.send(AUTH_CHANNELS.TOKEN_EXPIRED, { baseUrl, reason: 'expired' })
    mainWindow?.webContents.send(AUTH_CHANNELS.CONNECTION_STATUS_CHANGED, {
      baseUrl,
      status: 'expired',
    })
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
