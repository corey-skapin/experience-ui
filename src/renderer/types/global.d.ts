/// <reference types="vite/client" />

type Unsubscribe = () => void;

interface ExperienceUIBridge {
  cli: {
    sendMessage: (request: unknown) => Promise<unknown>;
    getStatus: () => Promise<unknown>;
    restart: () => Promise<unknown>;
    onStatusChanged: (callback: (event: unknown) => void) => Unsubscribe;
    onStreamResponse: (callback: (event: unknown) => void) => Unsubscribe;
  };
  auth: {
    configure: (request: unknown) => Promise<unknown>;
    testConnection: (request: unknown) => Promise<unknown>;
    getConnectionStatus: (request: unknown) => Promise<unknown>;
    startOAuthFlow: (request: unknown) => Promise<unknown>;
    clearCredentials: (request: unknown) => Promise<unknown>;
    onTokenExpired: (callback: (event: unknown) => void) => Unsubscribe;
    onTokenRefreshed: (callback: (event: unknown) => void) => Unsubscribe;
    onConnectionStatusChanged: (callback: (event: unknown) => void) => Unsubscribe;
  };
  proxy: {
    apiRequest: (request: unknown) => Promise<unknown>;
  };
  versions: {
    saveSnapshot: (request: unknown) => Promise<unknown>;
    list: (request: unknown) => Promise<unknown>;
    loadCode: (request: unknown) => Promise<unknown>;
    getDiff: (request: unknown) => Promise<unknown>;
  };
  plugins: {
    install: (request: unknown) => Promise<unknown>;
    uninstall: (request: unknown) => Promise<unknown>;
    list: () => Promise<unknown>;
    onStatusChanged: (callback: (event: unknown) => void) => Unsubscribe;
  };
  app: {
    compileCode: (request: unknown) => Promise<unknown>;
    validateCode: (request: unknown) => Promise<unknown>;
  };
}

interface Window {
  experienceUI: ExperienceUIBridge;
}
