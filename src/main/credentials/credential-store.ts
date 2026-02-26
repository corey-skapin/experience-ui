// src/main/credentials/credential-store.ts
// T046 + T055 — In-memory credential store with optional keytar persistence.
// Raw credentials are NEVER exposed outside this module (main-process only).
// Renderer receives only opaque connectionIds via get().

import { createHash } from 'node:crypto';

import {
  IPC_AUTH_CONNECTION_STATUS_CHANGED,
  IPC_AUTH_TOKEN_EXPIRED,
} from '../../shared/ipc-channels';

// ─── Types ────────────────────────────────────────────────────────────────────

export type RawCredentials =
  | { type: 'apiKey'; headerName: string; key: string }
  | { type: 'bearer'; token: string }
  | { type: 'oauth2'; accessToken: string; refreshToken?: string; expiresAt?: number };

export interface SetOptions {
  /** Auto-remove entry after this many milliseconds. */
  ttlMs?: number;
  /** Persist to OS keychain via keytar. */
  persist?: boolean;
  /** Called when the TTL timer fires. */
  onExpired?: () => void;
  /** Called 60 000 ms before TTL expiry (only when ttlMs > 60 000). */
  onRefresh?: () => void;
}

interface CredentialEntry {
  creds: RawCredentials;
  connectionId: string;
  ttlTimer?: ReturnType<typeof setTimeout>;
  refreshTimer?: ReturnType<typeof setTimeout>;
}

export type KeytarLike = {
  setPassword(service: string, account: string, password: string): Promise<void>;
  deletePassword(service: string, account: string): Promise<boolean>;
};

/** Provider function that resolves keytar (or null when unavailable). */
export type KeytarProvider = () => Promise<KeytarLike | null>;

/** Default provider: lazy-loads keytar from the native module. */
async function defaultKeytarProvider(): Promise<KeytarLike | null> {
  try {
    const mod = await import('keytar');
    return (mod.default ?? mod) as KeytarLike;
  } catch {
    return null;
  }
}

// ─── CredentialStore ─────────────────────────────────────────────────────────

/**
 * Main-process credential store.
 * Stores raw credentials in-memory; renderer receives opaque { connectionId }
 * refs only — raw values never cross the IPC boundary.
 *
 * @param keytarProvider - Optional override for keytar (useful in tests).
 */
export class CredentialStore {
  private readonly _store = new Map<string, CredentialEntry>();
  private readonly _getKeytar: KeytarProvider;

  constructor(keytarProvider?: KeytarProvider) {
    this._getKeytar = keytarProvider ?? defaultKeytarProvider;
  }

  /** Deterministic connectionId derived from baseUrl so it remains stable. */
  private static _makeConnectionId(baseUrl: string): string {
    return createHash('sha256').update(baseUrl).digest('hex').slice(0, 32);
  }

  // ── set ────────────────────────────────────────────────────────────────────

  set(baseUrl: string, creds: RawCredentials, opts: SetOptions = {}): void {
    // Clear any existing timers for this entry before replacing it
    this._clearTimers(baseUrl);

    const connectionId = CredentialStore._makeConnectionId(baseUrl);
    const entry: CredentialEntry = { creds, connectionId };

    if (opts.ttlMs !== undefined && opts.ttlMs > 0) {
      entry.ttlTimer = setTimeout(() => {
        this._store.delete(baseUrl);
        opts.onExpired?.();
      }, opts.ttlMs);

      // Refresh timer fires 60 s before expiry (only meaningful when ttlMs > 60 000)
      if (opts.onRefresh && opts.ttlMs > 60_000) {
        entry.refreshTimer = setTimeout(() => {
          opts.onRefresh?.();
        }, opts.ttlMs - 60_000);
      }
    }

    this._store.set(baseUrl, entry);

    if (opts.persist) {
      void this._getKeytar().then((kt) => {
        if (!kt) return;
        return kt.setPassword('experience-ui', baseUrl, JSON.stringify(creds));
      });
    }
  }

  // ── get (opaque) ────────────────────────────────────────────────────────────

  get(baseUrl: string): { connectionId: string } | null {
    const entry = this._store.get(baseUrl);
    if (!entry) return null;
    return { connectionId: entry.connectionId };
  }

  // ── getRaw (main-process only) ─────────────────────────────────────────────

  getRaw(baseUrl: string): RawCredentials | undefined {
    return this._store.get(baseUrl)?.creds;
  }

  // ── has ────────────────────────────────────────────────────────────────────

  has(baseUrl: string): boolean {
    return this._store.has(baseUrl);
  }

  // ── clear ──────────────────────────────────────────────────────────────────

  clear(baseUrl: string, clearPersisted = false): void {
    this._clearTimers(baseUrl);
    this._store.delete(baseUrl);

    if (clearPersisted) {
      void this._getKeytar().then((kt) => {
        if (!kt) return;
        return kt.deletePassword('experience-ui', baseUrl);
      });
    }
  }

  /** All stored baseUrls. */
  keys(): string[] {
    return Array.from(this._store.keys());
  }

  // ── dispose ────────────────────────────────────────────────────────────────

  /** Clear all timers (call in tests / app teardown). */
  dispose(): void {
    for (const baseUrl of this._store.keys()) {
      this._clearTimers(baseUrl);
    }
  }

  // ── health checks (T055) ───────────────────────────────────────────────────

  /**
   * Starts a periodic health-check loop for all stored connections.
   * Emits IPC push notifications to mainWindow on status change or 401.
   * Returns a stop function.
   */
  startHealthChecks(
    mainWindow: { webContents: { send: (channel: string, data: unknown) => void } },
    intervalMs = 300_000,
  ): () => void {
    const runCheck = async (): Promise<void> => {
      for (const baseUrl of this.keys()) {
        const raw = this.getRaw(baseUrl);
        if (!raw) continue;

        const headers: Record<string, string> = {};
        if (raw.type === 'apiKey') headers[raw.headerName] = raw.key;
        else if (raw.type === 'bearer') headers['Authorization'] = `Bearer ${raw.token}`;
        else if (raw.type === 'oauth2') headers['Authorization'] = `Bearer ${raw.accessToken}`;

        const start = Date.now();
        try {
          const res = await fetch(baseUrl, {
            method: 'GET',
            headers,
            signal: AbortSignal.timeout(10_000),
          });
          if (res.status === 401) {
            mainWindow.webContents.send(IPC_AUTH_TOKEN_EXPIRED, { baseUrl, reason: 'expired' });
          } else {
            mainWindow.webContents.send(IPC_AUTH_CONNECTION_STATUS_CHANGED, {
              baseUrl,
              status: res.ok ? 'connected' : 'degraded',
              responseTimeMs: Date.now() - start,
            });
          }
        } catch {
          mainWindow.webContents.send(IPC_AUTH_CONNECTION_STATUS_CHANGED, {
            baseUrl,
            status: 'unreachable',
            responseTimeMs: Date.now() - start,
          });
        }
      }
    };

    const timerId = setInterval(() => {
      void runCheck();
    }, intervalMs);
    return () => clearInterval(timerId);
  }

  // ── private helpers ────────────────────────────────────────────────────────

  private _clearTimers(baseUrl: string): void {
    const entry = this._store.get(baseUrl);
    if (!entry) return;
    if (entry.ttlTimer !== undefined) clearTimeout(entry.ttlTimer);
    if (entry.refreshTimer !== undefined) clearTimeout(entry.refreshTimer);
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

/** Application-wide credential store singleton (main process only). */
export const credentialStore = new CredentialStore();
