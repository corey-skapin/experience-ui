import { contextBridge, ipcRenderer } from 'electron';
import {
  IPC_CLI_SEND_MESSAGE,
  IPC_CLI_GET_STATUS,
  IPC_CLI_RESTART,
  IPC_CLI_STATUS_CHANGED,
  IPC_CLI_STREAM_RESPONSE,
  IPC_AUTH_CONFIGURE,
  IPC_AUTH_TEST_CONNECTION,
  IPC_AUTH_GET_CONNECTION_STATUS,
  IPC_AUTH_START_OAUTH_FLOW,
  IPC_AUTH_CLEAR_CREDENTIALS,
  IPC_AUTH_TOKEN_EXPIRED,
  IPC_AUTH_TOKEN_REFRESHED,
  IPC_AUTH_CONNECTION_STATUS_CHANGED,
  IPC_PROXY_API_REQUEST,
  IPC_VERSIONS_SAVE_SNAPSHOT,
  IPC_VERSIONS_LIST,
  IPC_VERSIONS_LOAD_CODE,
  IPC_VERSIONS_GET_DIFF,
  IPC_PLUGINS_INSTALL,
  IPC_PLUGINS_UNINSTALL,
  IPC_PLUGINS_LIST,
  IPC_PLUGINS_STATUS_CHANGED,
  IPC_APP_COMPILE_CODE,
  IPC_APP_VALIDATE_CODE,
} from '@shared/ipc-channels';

type Unsubscribe = () => void;

function createListener<T>(channel: string, callback: (event: T) => void): Unsubscribe {
  const handler = (_: Electron.IpcRendererEvent, event: T) => callback(event);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
}

const experienceUI = {
  cli: {
    sendMessage: (request: unknown) => ipcRenderer.invoke(IPC_CLI_SEND_MESSAGE, request),
    getStatus: () => ipcRenderer.invoke(IPC_CLI_GET_STATUS),
    restart: () => ipcRenderer.invoke(IPC_CLI_RESTART),
    onStatusChanged: (callback: (event: unknown) => void): Unsubscribe =>
      createListener(IPC_CLI_STATUS_CHANGED, callback),
    onStreamResponse: (callback: (event: unknown) => void): Unsubscribe =>
      createListener(IPC_CLI_STREAM_RESPONSE, callback),
  },

  auth: {
    configure: (request: unknown) => ipcRenderer.invoke(IPC_AUTH_CONFIGURE, request),
    testConnection: (request: unknown) => ipcRenderer.invoke(IPC_AUTH_TEST_CONNECTION, request),
    getConnectionStatus: (request: unknown) =>
      ipcRenderer.invoke(IPC_AUTH_GET_CONNECTION_STATUS, request),
    startOAuthFlow: (request: unknown) => ipcRenderer.invoke(IPC_AUTH_START_OAUTH_FLOW, request),
    clearCredentials: (request: unknown) =>
      ipcRenderer.invoke(IPC_AUTH_CLEAR_CREDENTIALS, request),
    onTokenExpired: (callback: (event: unknown) => void): Unsubscribe =>
      createListener(IPC_AUTH_TOKEN_EXPIRED, callback),
    onTokenRefreshed: (callback: (event: unknown) => void): Unsubscribe =>
      createListener(IPC_AUTH_TOKEN_REFRESHED, callback),
    onConnectionStatusChanged: (callback: (event: unknown) => void): Unsubscribe =>
      createListener(IPC_AUTH_CONNECTION_STATUS_CHANGED, callback),
  },

  proxy: {
    apiRequest: (request: unknown) => ipcRenderer.invoke(IPC_PROXY_API_REQUEST, request),
  },

  versions: {
    saveSnapshot: (request: unknown) => ipcRenderer.invoke(IPC_VERSIONS_SAVE_SNAPSHOT, request),
    list: (request: unknown) => ipcRenderer.invoke(IPC_VERSIONS_LIST, request),
    loadCode: (request: unknown) => ipcRenderer.invoke(IPC_VERSIONS_LOAD_CODE, request),
    getDiff: (request: unknown) => ipcRenderer.invoke(IPC_VERSIONS_GET_DIFF, request),
  },

  plugins: {
    install: (request: unknown) => ipcRenderer.invoke(IPC_PLUGINS_INSTALL, request),
    uninstall: (request: unknown) => ipcRenderer.invoke(IPC_PLUGINS_UNINSTALL, request),
    list: () => ipcRenderer.invoke(IPC_PLUGINS_LIST),
    onStatusChanged: (callback: (event: unknown) => void): Unsubscribe =>
      createListener(IPC_PLUGINS_STATUS_CHANGED, callback),
  },

  app: {
    compileCode: (request: unknown) => ipcRenderer.invoke(IPC_APP_COMPILE_CODE, request),
    validateCode: (request: unknown) => ipcRenderer.invoke(IPC_APP_VALIDATE_CODE, request),
  },
};

contextBridge.exposeInMainWorld('experienceUI', experienceUI);
