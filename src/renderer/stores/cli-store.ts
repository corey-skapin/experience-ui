// src/renderer/stores/cli-store.ts
// T025 — Zustand store for CLI subprocess state.
// Mirrors CLIState from shared/types and subscribes to cli:status-changed
// push notifications via the window.experienceUI bridge.

import { create } from 'zustand';

import type { CLIState } from '../../shared/types';

// ─── State Shape ──────────────────────────────────────────────────────────────

interface CLIStoreState extends CLIState {
  /** Update the CLI status from a push notification event. */
  applyStatusChange(event: { status: CLIState['status']; message?: string }): void;

  /** Sync full state from a getStatus() call. */
  syncState(state: CLIState): void;

  /**
   * Subscribe to cli:status-changed push notifications.
   * Returns a cleanup function to remove the listener.
   * Call this once from a top-level component or app initializer.
   */
  initialize(): () => void;
}

// ─── Initial State ────────────────────────────────────────────────────────────

const INITIAL_STATE: CLIState = {
  status: 'stopped',
  pid: null,
  lastCrashAt: null,
  restartCount: 0,
  pendingRequests: 0,
  errorMessage: null,
};

// ─── Store ────────────────────────────────────────────────────────────────────

export const useCLIStore = create<CLIStoreState>()((set) => ({
  ...INITIAL_STATE,

  applyStatusChange(event) {
    set((prev) => ({
      status: event.status,
      errorMessage: event.message ?? prev.errorMessage,
    }));
  },

  syncState(state: CLIState) {
    set(state);
  },

  initialize() {
    // Guard: bridge may not be available in test environments
    if (typeof window === 'undefined' || !window.experienceUI?.cli) {
      return () => undefined;
    }

    const unsubscribe = window.experienceUI.cli.onStatusChanged((event) => {
      set((prev) => ({
        status: event.status,
        errorMessage: event.message ?? prev.errorMessage,
      }));
    });

    return unsubscribe;
  },
}));

// ─── Selectors ────────────────────────────────────────────────────────────────

export const selectCLIStatus = (state: CLIStoreState): CLIState['status'] => state.status;
export const selectCLIPid = (state: CLIStoreState): number | null => state.pid;
export const selectCLIRestartCount = (state: CLIStoreState): number => state.restartCount;
export const selectCLIPendingRequests = (state: CLIStoreState): number => state.pendingRequests;
export const selectCLIErrorMessage = (state: CLIStoreState): string | null => state.errorMessage;
export const selectCLIState = (state: CLIStoreState): CLIState => ({
  status: state.status,
  pid: state.pid,
  lastCrashAt: state.lastCrashAt,
  restartCount: state.restartCount,
  pendingRequests: state.pendingRequests,
  errorMessage: state.errorMessage,
});
