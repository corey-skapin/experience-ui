// src/renderer/stores/auth-store.ts
// T050/T084 — Zustand auth store.
// Tracks ConnectionStatus per baseUrl and tabIds per connection.
// Subscribes to IPC push notifications.
// Raw credentials are NEVER stored here — only opaque status values.

import { create } from 'zustand';

import type { ConnectionStatus } from '../../shared/types';

// ─── State Shape ──────────────────────────────────────────────────────────────

interface AuthState {
  /**
   * Map of baseUrl → ConnectionStatus.
   * Renderer never holds raw credentials — only status derived from main-process events.
   */
  connections: Record<string, ConnectionStatus>;
  /**
   * Map of baseUrl → set of tabIds using that connection.
   * Per T084: when re-authenticating in one tab, all tabs using the same baseUrl are updated.
   */
  connectionTabIds: Record<string, string[]>;
}

interface AuthActions {
  /** Set (or update) the status for a baseUrl. */
  setStatus(baseUrl: string, status: ConnectionStatus): void;

  /** Return status for a baseUrl, defaulting to 'disconnected' if unknown. */
  getStatus(baseUrl: string): ConnectionStatus;

  /** Remove a connection entry entirely. */
  removeConnection(baseUrl: string): void;

  /** Associate a tabId with a baseUrl connection. */
  addTabToConnection(baseUrl: string, tabId: string): void;

  /** Disassociate a tabId from a baseUrl connection. */
  removeTabFromConnection(baseUrl: string, tabId: string): void;

  /** Get all tabIds using a given baseUrl connection. */
  getTabsForConnection(baseUrl: string): string[];

  /**
   * Subscribe to IPC push notifications from the auth bridge.
   * Returns a cleanup function that unsubscribes both listeners.
   * Call once from a top-level component or app initialiser.
   */
  initialize(): () => void;
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useAuthStore = create<AuthState & AuthActions>()((set, get) => ({
  connections: {},
  connectionTabIds: {},

  setStatus(baseUrl: string, status: ConnectionStatus) {
    set((s) => ({
      connections: { ...s.connections, [baseUrl]: status },
    }));
  },

  getStatus(baseUrl: string): ConnectionStatus {
    return get().connections[baseUrl] ?? 'disconnected';
  },

  removeConnection(baseUrl: string) {
    set((s) => {
      const { [baseUrl]: _removed, ...rest } = s.connections;
      const { [baseUrl]: _tabs, ...tabRest } = s.connectionTabIds;
      return { connections: rest, connectionTabIds: tabRest };
    });
  },

  addTabToConnection(baseUrl: string, tabId: string) {
    set((s) => {
      const existing = s.connectionTabIds[baseUrl] ?? [];
      if (existing.includes(tabId)) return s;
      return { connectionTabIds: { ...s.connectionTabIds, [baseUrl]: [...existing, tabId] } };
    });
  },

  removeTabFromConnection(baseUrl: string, tabId: string) {
    set((s) => {
      const existing = s.connectionTabIds[baseUrl] ?? [];
      return {
        connectionTabIds: {
          ...s.connectionTabIds,
          [baseUrl]: existing.filter((id) => id !== tabId),
        },
      };
    });
  },

  getTabsForConnection(baseUrl: string): string[] {
    return get().connectionTabIds[baseUrl] ?? [];
  },

  initialize() {
    // Guard: bridge may not be available in test environments
    if (typeof window === 'undefined' || !window.experienceUI?.auth) {
      return () => undefined;
    }

    const unsubExpired = window.experienceUI.auth.onTokenExpired((event) => {
      get().setStatus(event.baseUrl, 'expired');
    });

    const unsubStatusChanged = window.experienceUI.auth.onConnectionStatusChanged((event) => {
      // Bridge emits 'connected' | 'degraded' | 'unreachable' | 'expired'
      // All are valid ConnectionStatus values — update affects all tabs sharing this baseUrl
      get().setStatus(event.baseUrl, event.status as ConnectionStatus);
    });

    return () => {
      unsubExpired();
      unsubStatusChanged();
    };
  },
}));

// ─── Selectors ────────────────────────────────────────────────────────────────

export const selectConnections = (s: AuthState): Record<string, ConnectionStatus> => s.connections;
export const selectConnectionTabIds = (s: AuthState): Record<string, string[]> =>
  s.connectionTabIds;
