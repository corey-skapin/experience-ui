/**
 * Unit tests for auth Zustand store — TDD first, implementation follows.
 * Tests connection state transitions and per-base-URL tracking.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { act } from '@testing-library/react'
import { useAuthStore } from './auth-store'

// ─── Mock window.experienceUI ─────────────────────────────────────────────
// (already set up in vitest-setup.ts, but we augment here for specific callbacks)

describe('useAuthStore', () => {
  beforeEach(() => {
    // Reset store state between tests
    useAuthStore.getState().reset()
    vi.clearAllMocks()
  })

  // ─── Initial state ──────────────────────────────────────────────────────

  it('has empty connections map initially', () => {
    const { connections } = useAuthStore.getState()
    expect(connections.size).toBe(0)
  })

  // ─── setConnection ──────────────────────────────────────────────────────

  it('can set a connection to disconnected state', () => {
    act(() => {
      useAuthStore.getState().setConnection('https://api.example.com', {
        status: 'disconnected',
        authMethod: 'none',
        lastVerifiedAt: null,
        responseTimeMs: null,
      })
    })
    const conn = useAuthStore.getState().connections.get('https://api.example.com')
    expect(conn?.status).toBe('disconnected')
  })

  it('can transition from disconnected to connecting', () => {
    act(() => {
      useAuthStore.getState().setConnection('https://api.example.com', {
        status: 'disconnected',
        authMethod: 'none',
        lastVerifiedAt: null,
        responseTimeMs: null,
      })
      useAuthStore.getState().setConnectionStatus('https://api.example.com', 'connecting')
    })
    expect(useAuthStore.getState().connections.get('https://api.example.com')?.status).toBe(
      'connecting',
    )
  })

  it('can transition from connecting to connected', () => {
    act(() => {
      useAuthStore.getState().setConnection('https://api.example.com', {
        status: 'connecting',
        authMethod: 'apiKey',
        lastVerifiedAt: null,
        responseTimeMs: null,
      })
      useAuthStore.getState().setConnectionStatus('https://api.example.com', 'connected')
    })
    expect(useAuthStore.getState().connections.get('https://api.example.com')?.status).toBe(
      'connected',
    )
  })

  it('can transition from connected to expired', () => {
    act(() => {
      useAuthStore.getState().setConnection('https://api.example.com', {
        status: 'connected',
        authMethod: 'bearer',
        lastVerifiedAt: Date.now(),
        responseTimeMs: 100,
      })
      useAuthStore.getState().setConnectionStatus('https://api.example.com', 'expired')
    })
    expect(useAuthStore.getState().connections.get('https://api.example.com')?.status).toBe(
      'expired',
    )
  })

  it('tracks multiple base URLs independently', () => {
    act(() => {
      useAuthStore.getState().setConnection('https://api1.example.com', {
        status: 'connected',
        authMethod: 'apiKey',
        lastVerifiedAt: Date.now(),
        responseTimeMs: 50,
      })
      useAuthStore.getState().setConnection('https://api2.example.com', {
        status: 'disconnected',
        authMethod: 'none',
        lastVerifiedAt: null,
        responseTimeMs: null,
      })
    })

    expect(useAuthStore.getState().connections.get('https://api1.example.com')?.status).toBe(
      'connected',
    )
    expect(useAuthStore.getState().connections.get('https://api2.example.com')?.status).toBe(
      'disconnected',
    )
    expect(useAuthStore.getState().connections.size).toBe(2)
  })

  // ─── setConnectionStatus ────────────────────────────────────────────────

  it('setConnectionStatus is a no-op for unknown baseUrl', () => {
    // Should not throw
    act(() => {
      useAuthStore.getState().setConnectionStatus('https://unknown.example.com', 'connected')
    })
    expect(useAuthStore.getState().connections.size).toBe(0)
  })

  it('updates lastVerifiedAt when transitioning to connected', () => {
    const before = Date.now()
    act(() => {
      useAuthStore.getState().setConnection('https://api.example.com', {
        status: 'connecting',
        authMethod: 'bearer',
        lastVerifiedAt: null,
        responseTimeMs: null,
      })
      useAuthStore.getState().setConnectionStatus('https://api.example.com', 'connected')
    })
    const conn = useAuthStore.getState().connections.get('https://api.example.com')
    expect(conn?.lastVerifiedAt).not.toBeNull()
    expect(conn?.lastVerifiedAt).toBeGreaterThanOrEqual(before)
  })

  // ─── clearConnection ────────────────────────────────────────────────────

  it('can clear a specific connection', () => {
    act(() => {
      useAuthStore.getState().setConnection('https://api.example.com', {
        status: 'connected',
        authMethod: 'bearer',
        lastVerifiedAt: Date.now(),
        responseTimeMs: 100,
      })
      useAuthStore.getState().clearConnection('https://api.example.com')
    })
    expect(useAuthStore.getState().connections.has('https://api.example.com')).toBe(false)
  })

  // ─── getStatus ──────────────────────────────────────────────────────────

  it('getStatus returns disconnected for unknown baseUrl', () => {
    const status = useAuthStore.getState().getStatus('https://unknown.example.com')
    expect(status).toBe('disconnected')
  })

  it('getStatus returns current status for known baseUrl', () => {
    act(() => {
      useAuthStore.getState().setConnection('https://api.example.com', {
        status: 'expired',
        authMethod: 'oauth2',
        lastVerifiedAt: null,
        responseTimeMs: null,
      })
    })
    expect(useAuthStore.getState().getStatus('https://api.example.com')).toBe('expired')
  })

  // ─── reset ─────────────────────────────────────────────────────────────

  it('reset clears all connections', () => {
    act(() => {
      useAuthStore.getState().setConnection('https://api.example.com', {
        status: 'connected',
        authMethod: 'bearer',
        lastVerifiedAt: Date.now(),
        responseTimeMs: 100,
      })
      useAuthStore.getState().reset()
    })
    expect(useAuthStore.getState().connections.size).toBe(0)
  })
})
