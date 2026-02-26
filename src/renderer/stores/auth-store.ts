/**
 * Auth Zustand store.
 * Tracks connection state per base URL.
 * Subscribes to push notifications from main process.
 */
import { create } from 'zustand'
import type { ConnectionStatus } from '../../shared/types'

// ─── State types ───────────────────────────────────────────────────────────

export type AuthMethodType = 'none' | 'apiKey' | 'bearer' | 'oauth2'

export interface ConnectionEntry {
  status: ConnectionStatus
  authMethod: AuthMethodType
  lastVerifiedAt: number | null
  responseTimeMs: number | null
}

export interface AuthStoreState {
  connections: Map<string, ConnectionEntry>

  setConnection: (baseUrl: string, entry: ConnectionEntry) => void
  setConnectionStatus: (baseUrl: string, status: ConnectionStatus) => void
  setResponseTime: (baseUrl: string, responseTimeMs: number) => void
  clearConnection: (baseUrl: string) => void
  getStatus: (baseUrl: string) => ConnectionStatus
  reset: () => void
}

// ─── Store ────────────────────────────────────────────────────────────────

export const useAuthStore = create<AuthStoreState>((set, get) => ({
  connections: new Map(),

  setConnection: (baseUrl, entry) =>
    set((state) => {
      const next = new Map(state.connections)
      next.set(baseUrl, entry)
      return { connections: next }
    }),

  setConnectionStatus: (baseUrl, status) =>
    set((state) => {
      const existing = state.connections.get(baseUrl)
      if (!existing) return state

      const next = new Map(state.connections)
      next.set(baseUrl, {
        ...existing,
        status,
        lastVerifiedAt: status === 'connected' ? Date.now() : existing.lastVerifiedAt,
      })
      return { connections: next }
    }),

  setResponseTime: (baseUrl, responseTimeMs) =>
    set((state) => {
      const existing = state.connections.get(baseUrl)
      if (!existing) return state
      const next = new Map(state.connections)
      next.set(baseUrl, { ...existing, responseTimeMs })
      return { connections: next }
    }),

  clearConnection: (baseUrl) =>
    set((state) => {
      const next = new Map(state.connections)
      next.delete(baseUrl)
      return { connections: next }
    }),

  getStatus: (baseUrl) => {
    return get().connections.get(baseUrl)?.status ?? 'disconnected'
  },

  reset: () => set({ connections: new Map() }),
}))

// ─── Subscribe to push notifications ──────────────────────────────────────

if (typeof window !== 'undefined' && window.experienceUI?.auth) {
  // Token expired → mark connection as expired
  window.experienceUI.auth.onTokenExpired((event) => {
    useAuthStore.getState().setConnectionStatus(event.baseUrl, 'expired')
  })

  // Connection status changed → update store
  window.experienceUI.auth.onConnectionStatusChanged((event) => {
    const mapped = event.status as ConnectionStatus
    useAuthStore.getState().setConnectionStatus(event.baseUrl, mapped)
  })
}
