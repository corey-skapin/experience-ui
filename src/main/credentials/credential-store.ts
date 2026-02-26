/**
 * CredentialStore — secure in-memory credential management with optional keytar persistence.
 * - Stores raw credentials in main process only (renderer never sees them)
 * - Returns opaque references (UUIDs) to the renderer
 * - Supports TTL-based auto-expiry
 * - Supports keytar persistence opt-in
 */
import { randomUUID } from 'crypto'

// ─── Types ─────────────────────────────────────────────────────────────────

export type RawCredential =
  | { type: 'apiKey'; headerName: string; key: string }
  | { type: 'bearer'; token: string }
  | {
      type: 'oauth2'
      accessToken: string
      refreshToken?: string
      expiresAt?: number
    }

export interface SetCredentialOptions {
  /** If true, persist to OS keychain via keytar. Default: false. */
  persist?: boolean
  /** Time-to-live in milliseconds. Undefined = never expires. */
  ttlMs?: number
}

export interface ClearCredentialOptions {
  /** If true, also remove from OS keychain. Default: false. */
  clearPersisted?: boolean
}

export interface KeytarLike {
  getPassword(service: string, account: string): Promise<string | null>
  setPassword(service: string, account: string, password: string): Promise<void>
  deletePassword(service: string, account: string): Promise<boolean>
}

/** Dependency injection provider for keytar. */
export type KeytarProvider = () => Promise<KeytarLike>

interface StoredEntry {
  ref: string
  credential: RawCredential
  expiresAt: number | null
  timer: ReturnType<typeof setTimeout> | null
}

const KEYCHAIN_SERVICE = 'experience-ui'

// ─── CredentialStore ───────────────────────────────────────────────────────

export class CredentialStore {
  private readonly entries = new Map<string, StoredEntry>()
  private readonly keytarProvider: KeytarProvider
  private healthCheckInterval: ReturnType<typeof setInterval> | null = null

  constructor(keytarProvider: KeytarProvider) {
    this.keytarProvider = keytarProvider
  }

  // ─── Set credentials ──────────────────────────────────────────────────

  setCredentials(
    baseUrl: string,
    credential: RawCredential,
    options: SetCredentialOptions = {},
  ): string {
    const existing = this.entries.get(baseUrl)

    // Reuse existing ref if already present, otherwise generate a new one
    const ref = existing?.ref ?? randomUUID()

    // Clear any existing expiry timer
    if (existing?.timer) clearTimeout(existing.timer)

    const expiresAt = options.ttlMs != null ? Date.now() + options.ttlMs : null

    let timer: ReturnType<typeof setTimeout> | null = null
    if (options.ttlMs != null) {
      timer = setTimeout(() => {
        this.entries.delete(baseUrl)
      }, options.ttlMs)
      if (timer.unref) timer.unref()
    }

    this.entries.set(baseUrl, { ref, credential, expiresAt, timer })

    if (options.persist) {
      void this.persistToKeytar(baseUrl, credential)
    }

    return ref
  }

  // ─── Get auth headers ─────────────────────────────────────────────────

  getAuthHeaders(baseUrl: string): Record<string, string> {
    const entry = this.getValidEntry(baseUrl)
    if (!entry) return {}

    const { credential } = entry
    switch (credential.type) {
      case 'apiKey':
        return { [credential.headerName]: credential.key }
      case 'bearer':
        return { Authorization: `Bearer ${credential.token}` }
      case 'oauth2':
        return { Authorization: `Bearer ${credential.accessToken}` }
    }
  }

  // ─── Get opaque ref ───────────────────────────────────────────────────

  getCredentialRef(baseUrl: string): string | null {
    const entry = this.getValidEntry(baseUrl)
    return entry?.ref ?? null
  }

  // ─── Has credentials ──────────────────────────────────────────────────

  hasCredentials(baseUrl: string): boolean {
    return this.getValidEntry(baseUrl) !== null
  }

  // ─── Clear credentials ────────────────────────────────────────────────

  clearCredentials(baseUrl: string, options: ClearCredentialOptions = {}): void {
    const entry = this.entries.get(baseUrl)
    if (entry?.timer) clearTimeout(entry.timer)
    this.entries.delete(baseUrl)

    if (options.clearPersisted) {
      void this.deleteFromKeytar(baseUrl)
    }
  }

  // ─── Periodic health checks ───────────────────────────────────────────

  startHealthChecks(onExpired: (baseUrl: string, reason: 'expired') => void): void {
    if (this.healthCheckInterval) return
    this.healthCheckInterval = setInterval(
      () => {
        const now = Date.now()
        for (const [baseUrl, entry] of this.entries.entries()) {
          if (entry.expiresAt !== null && now >= entry.expiresAt) {
            if (entry.timer) clearTimeout(entry.timer)
            this.entries.delete(baseUrl)
            onExpired(baseUrl, 'expired')
          }
        }
      },
      5 * 60 * 1000,
    ) // 5 minutes
    if (this.healthCheckInterval.unref) this.healthCheckInterval.unref()
  }

  // ─── Destroy (cleanup all timers) ─────────────────────────────────────

  destroy(): void {
    for (const entry of this.entries.values()) {
      if (entry.timer) clearTimeout(entry.timer)
    }
    this.entries.clear()
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval)
      this.healthCheckInterval = null
    }
  }

  // ─── Private helpers ──────────────────────────────────────────────────

  private getValidEntry(baseUrl: string): StoredEntry | null {
    const entry = this.entries.get(baseUrl)
    if (!entry) return null

    // Check TTL expiry
    if (entry.expiresAt !== null && Date.now() >= entry.expiresAt) {
      if (entry.timer) clearTimeout(entry.timer)
      this.entries.delete(baseUrl)
      return null
    }

    return entry
  }

  private async persistToKeytar(baseUrl: string, credential: RawCredential): Promise<void> {
    try {
      const keytar = await this.keytarProvider()
      await keytar.setPassword(KEYCHAIN_SERVICE, baseUrl, JSON.stringify(credential))
    } catch {
      // Keytar failures are non-fatal — credentials remain in memory
    }
  }

  private async deleteFromKeytar(baseUrl: string): Promise<void> {
    try {
      const keytar = await this.keytarProvider()
      await keytar.deletePassword(KEYCHAIN_SERVICE, baseUrl)
    } catch {
      // Non-fatal
    }
  }
}
