// @vitest-environment node
/**
 * Unit tests for CredentialStore — TDD first, implementation follows.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { CredentialStore } from './credential-store'
import type { KeytarProvider } from './credential-store'

// ─── Mock keytar ──────────────────────────────────────────────────────────

const mockKeytar = {
  getPassword: vi.fn(),
  setPassword: vi.fn(),
  deletePassword: vi.fn(),
}

const keytarProvider: KeytarProvider = () => Promise.resolve(mockKeytar)

// ─── Tests ────────────────────────────────────────────────────────────────

describe('CredentialStore', () => {
  let store: CredentialStore

  beforeEach(() => {
    vi.useRealTimers()
    mockKeytar.getPassword.mockReset()
    mockKeytar.setPassword.mockReset()
    mockKeytar.deletePassword.mockReset()
    store = new CredentialStore(keytarProvider)
  })

  afterEach(() => {
    store.destroy()
  })

  // ─── Set / get by baseUrl ───────────────────────────────────────────────

  it('returns null for unknown baseUrl', () => {
    const ref = store.getCredentialRef('https://api.example.com')
    expect(ref).toBeNull()
  })

  it('stores API key credentials and returns an opaque reference', () => {
    const ref = store.setCredentials('https://api.example.com', {
      type: 'apiKey',
      headerName: 'X-API-Key',
      key: 'secret-key-123',
    })
    expect(typeof ref).toBe('string')
    expect(ref.length).toBeGreaterThan(0)
    // The ref must NOT contain the raw key
    expect(ref).not.toContain('secret-key-123')
  })

  it('returns same ref for same baseUrl on second set', () => {
    const ref1 = store.setCredentials('https://api.example.com', {
      type: 'apiKey',
      headerName: 'X-API-Key',
      key: 'key1',
    })
    const ref2 = store.setCredentials('https://api.example.com', {
      type: 'apiKey',
      headerName: 'X-API-Key',
      key: 'key2',
    })
    expect(ref1).toBe(ref2)
  })

  it('retrieves headers for API key credential', () => {
    store.setCredentials('https://api.example.com', {
      type: 'apiKey',
      headerName: 'X-API-Key',
      key: 'my-api-key',
    })
    const headers = store.getAuthHeaders('https://api.example.com')
    expect(headers).toEqual({ 'X-API-Key': 'my-api-key' })
  })

  it('retrieves headers for bearer token credential', () => {
    store.setCredentials('https://api.example.com', {
      type: 'bearer',
      token: 'my-bearer-token',
    })
    const headers = store.getAuthHeaders('https://api.example.com')
    expect(headers).toEqual({ Authorization: 'Bearer my-bearer-token' })
  })

  it('returns empty headers for unknown baseUrl', () => {
    const headers = store.getAuthHeaders('https://unknown.example.com')
    expect(headers).toEqual({})
  })

  it('getCredentialRef returns the opaque ref after set', () => {
    const ref = store.setCredentials('https://api.example.com', {
      type: 'bearer',
      token: 'tok',
    })
    expect(store.getCredentialRef('https://api.example.com')).toBe(ref)
  })

  // ─── Per-baseUrl scoping ────────────────────────────────────────────────

  it('scopes credentials per base URL', () => {
    store.setCredentials('https://api1.example.com', { type: 'bearer', token: 'token-1' })
    store.setCredentials('https://api2.example.com', { type: 'bearer', token: 'token-2' })

    expect(store.getAuthHeaders('https://api1.example.com')).toEqual({
      Authorization: 'Bearer token-1',
    })
    expect(store.getAuthHeaders('https://api2.example.com')).toEqual({
      Authorization: 'Bearer token-2',
    })
  })

  // ─── TTL expiry ────────────────────────────────────────────────────────

  it('credentials expire after TTL', () => {
    vi.useFakeTimers()
    store.setCredentials(
      'https://api.example.com',
      { type: 'bearer', token: 'expiring-token' },
      { ttlMs: 1000 },
    )

    // Before expiry
    expect(store.getAuthHeaders('https://api.example.com')).toEqual({
      Authorization: 'Bearer expiring-token',
    })

    // Advance past TTL
    vi.advanceTimersByTime(1001)

    expect(store.getAuthHeaders('https://api.example.com')).toEqual({})
    expect(store.getCredentialRef('https://api.example.com')).toBeNull()
  })

  it('credentials without TTL do not expire', () => {
    vi.useFakeTimers()
    store.setCredentials('https://api.example.com', { type: 'bearer', token: 'permanent-token' })

    vi.advanceTimersByTime(24 * 60 * 60 * 1000) // 24 hours

    expect(store.getAuthHeaders('https://api.example.com')).toEqual({
      Authorization: 'Bearer permanent-token',
    })
  })

  // ─── Persistent storage opt-in (keytar) ───────────────────────────────

  it('does NOT call keytar when persist is false (default)', async () => {
    store.setCredentials('https://api.example.com', { type: 'bearer', token: 'token' })
    // Give any pending async calls time to settle
    await new Promise((r) => setTimeout(r, 0))
    expect(mockKeytar.setPassword).not.toHaveBeenCalled()
  })

  it('persists credentials to keytar when persist is true', async () => {
    store.setCredentials(
      'https://api.example.com',
      { type: 'bearer', token: 'persist-token' },
      { persist: true },
    )
    await new Promise((r) => setTimeout(r, 10))
    expect(mockKeytar.setPassword).toHaveBeenCalledWith(
      'experience-ui',
      'https://api.example.com',
      expect.any(String),
    )
  })

  // ─── Opaque references (renderer never sees raw credentials) ──────────

  it('getCredentialRef returns an opaque string that is not the raw secret', () => {
    store.setCredentials('https://api.example.com', {
      type: 'apiKey',
      headerName: 'Authorization',
      key: 'super-secret-value',
    })
    const ref = store.getCredentialRef('https://api.example.com')
    expect(ref).not.toBeNull()
    expect(ref).not.toContain('super-secret-value')
  })

  // ─── Clear credentials ─────────────────────────────────────────────────

  it('clearCredentials removes in-memory credentials', () => {
    store.setCredentials('https://api.example.com', { type: 'bearer', token: 'tok' })
    store.clearCredentials('https://api.example.com')
    expect(store.getAuthHeaders('https://api.example.com')).toEqual({})
    expect(store.getCredentialRef('https://api.example.com')).toBeNull()
  })

  it('clearCredentials calls keytar.deletePassword when clearPersisted is true', async () => {
    store.clearCredentials('https://api.example.com', { clearPersisted: true })
    await new Promise((r) => setTimeout(r, 10))
    expect(mockKeytar.deletePassword).toHaveBeenCalledWith(
      'experience-ui',
      'https://api.example.com',
    )
  })

  it('clearCredentials does NOT call keytar when clearPersisted is false', async () => {
    store.clearCredentials('https://api.example.com', { clearPersisted: false })
    await new Promise((r) => setTimeout(r, 10))
    expect(mockKeytar.deletePassword).not.toHaveBeenCalled()
  })

  // ─── hasCredentials ────────────────────────────────────────────────────

  it('hasCredentials returns false for unknown url', () => {
    expect(store.hasCredentials('https://unknown.com')).toBe(false)
  })

  it('hasCredentials returns true after setting credentials', () => {
    store.setCredentials('https://api.example.com', { type: 'bearer', token: 'tok' })
    expect(store.hasCredentials('https://api.example.com')).toBe(true)
  })

  it('hasCredentials returns false after clearing credentials', () => {
    store.setCredentials('https://api.example.com', { type: 'bearer', token: 'tok' })
    store.clearCredentials('https://api.example.com')
    expect(store.hasCredentials('https://api.example.com')).toBe(false)
  })
})
