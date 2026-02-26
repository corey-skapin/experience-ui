/**
 * CLI state Zustand store.
 * Tracks CLI subprocess status, pid, restart count, and pending requests.
 * Subscribes to cli:status-changed push notifications from main process.
 */
import { create } from 'zustand'
import type { CLIStatusResponse } from '../../shared/types/ipc'

// ─── State ────────────────────────────────────────────────────────────────

export type CLIStatus = 'stopped' | 'starting' | 'running' | 'crashed' | 'restarting'

export interface CLIStoreState {
  status: CLIStatus
  pid: number | null
  restartCount: number
  pendingRequests: number
  errorMessage: string | null
  uptime: number | null

  // ─── Actions ───────────────────────────────────────────────────────────

  updateFromStatusEvent: (event: CLIStatusResponse) => void
  setError: (message: string | null) => void
  reset: () => void
}

const initialState = {
  status: 'stopped' as CLIStatus,
  pid: null,
  restartCount: 0,
  pendingRequests: 0,
  errorMessage: null,
  uptime: null,
}

// ─── Store ────────────────────────────────────────────────────────────────

export const useCLIStore = create<CLIStoreState>((set) => ({
  ...initialState,

  updateFromStatusEvent: (event) =>
    set({
      status: event.status,
      pid: event.pid,
      restartCount: event.restartCount,
      pendingRequests: event.pendingRequests,
      uptime: event.uptime,
    }),

  setError: (message) => set({ errorMessage: message }),

  reset: () => set(initialState),
}))

// ─── Push notification subscription ──────────────────────────────────────

/**
 * Subscribes to cli:status-changed push notifications.
 * Call once at app startup. Returns unsubscribe function.
 */
export function subscribeCLIStatusUpdates(): () => void {
  const bridge = window.experienceUI
  if (!bridge?.cli?.onStatusChanged) return () => undefined

  const unsubscribe = bridge.cli.onStatusChanged((event: CLIStatusResponse) => {
    useCLIStore.getState().updateFromStatusEvent(event)
  })

  return unsubscribe
}
