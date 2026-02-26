/**
 * Electron preload script.
 * Exposes the ExperienceUIBridge interface to the renderer via contextBridge.
 * The renderer process NEVER has direct access to Node.js or Electron APIs.
 */
import { contextBridge, ipcRenderer } from 'electron'
import type { CLIState, APIConnection, InterfaceVersion, Plugin } from '../shared/types/index'
import {
  CLI_CHANNELS,
  AUTH_CHANNELS,
  PROXY_CHANNELS,
  VERSIONS_CHANNELS,
  PLUGINS_CHANNELS,
  APP_CHANNELS,
} from '../shared/ipc-channels'

// Type-safe IPC invoke helper
function invoke<T>(channel: string, ...args: unknown[]): Promise<T> {
  return ipcRenderer.invoke(channel, ...args) as Promise<T>
}

// Type-safe push notification subscriber (returns unsubscribe function)
function subscribe<T>(channel: string, listener: (payload: T) => void): () => void {
  const handler = (_event: Electron.IpcRendererEvent, payload: T): void => {
    listener(payload)
  }
  ipcRenderer.on(channel, handler)
  return () => ipcRenderer.removeListener(channel, handler)
}

const bridge = {
  cli: {
    sendMessage: (message: unknown) => invoke<unknown>(CLI_CHANNELS.SEND_MESSAGE, message),
    getStatus: () => invoke<CLIState>(CLI_CHANNELS.GET_STATUS),
    restart: () => invoke<void>(CLI_CHANNELS.RESTART),
    onStatusChanged: (cb: (state: CLIState) => void) =>
      subscribe<CLIState>(CLI_CHANNELS.STATUS_CHANGED, cb),
    onStreamResponse: (cb: (chunk: unknown) => void) =>
      subscribe<unknown>(CLI_CHANNELS.STREAM_RESPONSE, cb),
  },

  auth: {
    configure: (baseUrl: string, method: unknown) =>
      invoke<void>(AUTH_CHANNELS.CONFIGURE, baseUrl, method),
    testConnection: (baseUrl: string) =>
      invoke<APIConnection>(AUTH_CHANNELS.TEST_CONNECTION, baseUrl),
    getConnectionStatus: (baseUrl: string) =>
      invoke<APIConnection>(AUTH_CHANNELS.GET_CONNECTION_STATUS, baseUrl),
    clearCredentials: (baseUrl: string) => invoke<void>(AUTH_CHANNELS.CLEAR_CREDENTIALS, baseUrl),
    startOAuthFlow: (params: unknown) => invoke<void>(AUTH_CHANNELS.START_OAUTH_FLOW, params),
    onTokenExpired: (cb: (baseUrl: string) => void) =>
      subscribe<string>(AUTH_CHANNELS.TOKEN_EXPIRED, cb),
    onConnectionStatusChanged: (cb: (connection: APIConnection) => void) =>
      subscribe<APIConnection>(AUTH_CHANNELS.CONNECTION_STATUS_CHANGED, cb),
  },

  proxy: {
    apiRequest: (request: unknown) => invoke<unknown>(PROXY_CHANNELS.API_REQUEST, request),
  },

  versions: {
    saveSnapshot: (snapshot: unknown) =>
      invoke<InterfaceVersion>(VERSIONS_CHANNELS.SAVE_SNAPSHOT, snapshot),
    list: (interfaceId: string, page: number) =>
      invoke<InterfaceVersion[]>(VERSIONS_CHANNELS.LIST, interfaceId, page),
    loadCode: (versionId: string) => invoke<string>(VERSIONS_CHANNELS.LOAD_CODE, versionId),
    getDiff: (versionIdA: string, versionIdB: string) =>
      invoke<unknown>(VERSIONS_CHANNELS.GET_DIFF, versionIdA, versionIdB),
  },

  plugins: {
    install: (pluginId: string) => invoke<Plugin>(PLUGINS_CHANNELS.INSTALL, pluginId),
    uninstall: (pluginId: string) => invoke<void>(PLUGINS_CHANNELS.UNINSTALL, pluginId),
    list: () => invoke<Plugin[]>(PLUGINS_CHANNELS.LIST),
    enable: (pluginId: string) => invoke<void>(PLUGINS_CHANNELS.ENABLE, pluginId),
    disable: (pluginId: string) => invoke<void>(PLUGINS_CHANNELS.DISABLE, pluginId),
  },

  app: {
    compileCode: (code: string) => invoke<string>(APP_CHANNELS.COMPILE_CODE, code),
    validateCode: (code: string) => invoke<unknown>(APP_CHANNELS.VALIDATE_CODE, code),
  },
}

contextBridge.exposeInMainWorld('experienceUI', bridge)

// Expose the bridge type for use in renderer TypeScript code
export type ExperienceUIBridge = typeof bridge
