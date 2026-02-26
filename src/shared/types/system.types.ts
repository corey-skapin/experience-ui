export interface CLIState {
  status: 'stopped' | 'starting' | 'running' | 'crashed' | 'restarting';
  pid: number | null;
  lastCrashAt: string | null;
  restartCount: number;
  pendingRequests: number;
  errorMessage: string | null;
}

export interface Plugin {
  id: string;
  name: string;
  type: 'mcp-server' | 'transformer' | 'integration';
  version: string;
  status: 'installed' | 'installing' | 'error' | 'uninstalling';
  configPath: string | null;
  capabilities: string[];
  installPath: string;
  installedAt: string;
  dependentInterfaces?: string[];
  errorMessage: string | null;
}

export interface ConsoleRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: string;
}

export interface ConsoleResponse {
  statusCode: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  bodySize: number;
}

export interface ConsoleEntry {
  id: string;
  tabId: string;
  timestamp: string;
  request: ConsoleRequest;
  response: ConsoleResponse | null;
  elapsedMs: number | null;
  status: 'pending' | 'completed' | 'error';
}
