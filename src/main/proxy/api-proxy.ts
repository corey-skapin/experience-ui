import type { IpcMain } from 'electron';
import { NETWORK_REQUEST_TIMEOUT_MS } from '../../shared/constants';

export interface ProxyAPIRequest {
  url: string;
  method: string;
  headers?: Record<string, string>;
  body?: string;
}

export interface ProxyAPIResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  elapsedMs: number;
  ok: boolean;
}

export function registerProxyHandler(ipcMain: IpcMain, channel: string): void {
  ipcMain.handle(channel, async (_event, request: unknown) => {
    const req = request as ProxyAPIRequest;
    const startTime = Date.now();

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), NETWORK_REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(req.url, {
        method: req.method,
        headers: req.headers,
        body: req.body,
        signal: controller.signal,
      });

      const body = await response.text();
      const headers: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        headers[key] = value;
      });

      return {
        status: response.status,
        statusText: response.statusText,
        headers,
        body,
        elapsedMs: Date.now() - startTime,
        ok: response.ok,
      } satisfies ProxyAPIResponse;
    } finally {
      clearTimeout(timeout);
    }
  });
}
