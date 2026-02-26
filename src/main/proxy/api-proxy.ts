// src/main/proxy/api-proxy.ts
// T040 + T049 — Main-process API network proxy.
// Registers an IPC handler that fetches external URLs on behalf of the renderer,
// keeping network access out of the sandboxed renderer process entirely.
// T049: injects auth headers from credentialStore before each request.
//       On 401, emits IPC_AUTH_TOKEN_EXPIRED to mainWindow.

import { ipcMain } from 'electron';

import { IPC_AUTH_TOKEN_EXPIRED, IPC_PROXY_API_REQUEST } from '../../shared/ipc-channels';
import type { ProxyAPIRequest, ProxyAPIResponse, TokenExpiredEvent } from '../preload-types';
import { PROXY_REQUEST_TIMEOUT_MS } from '../../shared/constants';
import type { CredentialStore } from '../credentials/credential-store';

type MainWindowRef = { webContents: { send: (channel: string, data: unknown) => void } } | null;

// ─── Validation ───────────────────────────────────────────────────────────────

/**
 * Ensures the request path cannot escape the intended baseUrl.
 * Rejects absolute URLs embedded in `path` (e.g. `//evil.com/...`) and
 * path-traversal sequences (e.g. `../../etc/passwd`).
 */
function validateRequestPath(path: string): void {
  if (path.startsWith('//') || /^https?:\/\//i.test(path)) {
    throw new Error(`Invalid request path: absolute URLs are not allowed (got "${path}")`);
  }
  if (path.includes('..')) {
    throw new Error(
      `Invalid request path: path traversal sequences are not allowed (got "${path}")`,
    );
  }
}

// ─── Auth header injection ────────────────────────────────────────────────────

/**
 * Returns headers to inject for the given baseUrl, using raw credentials from
 * credentialStore. Returns an empty object when no credentials are stored.
 */
function buildAuthHeaders(
  baseUrl: string,
  credentialStore: CredentialStore | null,
): Record<string, string> {
  if (!credentialStore) return {};
  const raw = credentialStore.getRaw(baseUrl);
  if (!raw) return {};

  if (raw.type === 'apiKey') return { [raw.headerName]: raw.key };
  if (raw.type === 'bearer') return { Authorization: `Bearer ${raw.token}` };
  if (raw.type === 'oauth2') return { Authorization: `Bearer ${raw.accessToken}` };
  return {};
}

// ─── Registration ─────────────────────────────────────────────────────────────

/**
 * Registers the `proxy:api-request` IPC handler on the main process.
 * Should be called once during app initialisation, before any window is created.
 *
 * Security notes:
 *  - The renderer cannot make network requests directly (CSP + no nodeIntegration).
 *  - All requests are routed through here, giving the main process full visibility.
 *  - Callers should validate `req.baseUrl` against an allowlist before calling this.
 */
export function registerApiProxy(
  credentialStore: CredentialStore | null = null,
  getMainWindow: () => MainWindowRef = () => null,
): void {
  ipcMain.handle(
    IPC_PROXY_API_REQUEST,
    async (_event, req: ProxyAPIRequest): Promise<ProxyAPIResponse> => {
      const url = `${req.baseUrl}${req.path}`;
      const start = Date.now();

      try {
        validateRequestPath(req.path);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { status: 400, statusText: message, headers: {}, body: '', elapsedMs: 0 };
      }

      // ── Inject auth headers ───────────────────────────────────────────────
      const authHeaders = buildAuthHeaders(req.baseUrl, credentialStore);
      const mergedHeaders = { ...req.headers, ...authHeaders };

      const controller = new AbortController();
      const timeoutMs = req.timeout ?? PROXY_REQUEST_TIMEOUT_MS;
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(url, {
          method: req.method,
          headers: mergedHeaders,
          body: req.body,
          signal: controller.signal,
        });

        const body = await response.text();

        const headers: Record<string, string> = {};
        response.headers.forEach((value, key) => {
          headers[key] = value;
        });

        // ── Emit token-expired on 401 ─────────────────────────────────────
        if (response.status === 401) {
          const mainWin = getMainWindow();
          if (mainWin) {
            const event: TokenExpiredEvent = { baseUrl: req.baseUrl, reason: 'expired' };
            mainWin.webContents.send(IPC_AUTH_TOKEN_EXPIRED, event);
          }
        }

        return {
          status: response.status,
          statusText: response.statusText,
          headers,
          body,
          elapsedMs: Date.now() - start,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          status: 0,
          statusText: message,
          headers: {},
          body: '',
          elapsedMs: Date.now() - start,
        };
      } finally {
        clearTimeout(timeoutId);
      }
    },
  );
}
