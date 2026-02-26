// src/main/credentials/credential-store.test.ts
// T044 — RED tests for CredentialStore.
// All tests must fail until the implementation is complete (T046).

import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { CredentialStore } from './credential-store';
import type { KeytarLike } from './credential-store';

// ─── Mock keytar (injected via constructor) ───────────────────────────────────

const mockSetPassword = vi.fn().mockResolvedValue(undefined);
const mockDeletePassword = vi.fn().mockResolvedValue(true);

const mockKeytar: KeytarLike = {
  setPassword: mockSetPassword,
  deletePassword: mockDeletePassword,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const BASE_URL = 'https://api.example.com';
const API_KEY_CREDS = { type: 'apiKey' as const, headerName: 'X-API-Key', key: 'secret123' };
const BEARER_CREDS = { type: 'bearer' as const, token: 'tok_secret' };
const OAUTH_CREDS = {
  type: 'oauth2' as const,
  accessToken: 'access_tok',
  refreshToken: 'refresh_tok',
  expiresAt: Date.now() + 3_600_000,
};

/** Flush pending microtasks (e.g. fire-and-forget async keytar calls). */
async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('CredentialStore', () => {
  let store: CredentialStore;

  beforeEach(() => {
    vi.useFakeTimers();
    store = new CredentialStore(() => Promise.resolve(mockKeytar));
    vi.clearAllMocks();
  });

  afterEach(() => {
    store.dispose();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  // ── set / get ───────────────────────────────────────────────────────────────

  describe('set and get', () => {
    it('stores apiKey credentials and returns an opaque connectionId', () => {
      store.set(BASE_URL, API_KEY_CREDS, {});
      const result = store.get(BASE_URL);
      expect(result).not.toBeNull();
      expect(result).toHaveProperty('connectionId');
      expect(typeof result?.connectionId).toBe('string');
    });

    it('returns null for an unknown baseUrl', () => {
      expect(store.get('https://unknown.com')).toBeNull();
    });

    it('get does NOT expose raw credential fields', () => {
      store.set(BASE_URL, BEARER_CREDS, {});
      const result = store.get(BASE_URL);
      expect(result).not.toHaveProperty('token');
      expect(result).not.toHaveProperty('key');
      expect(result).not.toHaveProperty('headerName');
      expect(result).not.toHaveProperty('accessToken');
    });

    it('returns a consistent connectionId for the same baseUrl within a session', () => {
      store.set(BASE_URL, API_KEY_CREDS, {});
      const first = store.get(BASE_URL);
      const second = store.get(BASE_URL);
      expect(first?.connectionId).toBe(second?.connectionId);
    });

    it('updates credentials when set is called again for the same baseUrl', () => {
      store.set(BASE_URL, BEARER_CREDS, {});
      store.set(BASE_URL, API_KEY_CREDS, {});
      expect(store.getRaw(BASE_URL)).toEqual(API_KEY_CREDS);
    });
  });

  // ── getRaw ──────────────────────────────────────────────────────────────────

  describe('getRaw', () => {
    it('returns raw apiKey credentials', () => {
      store.set(BASE_URL, API_KEY_CREDS, {});
      expect(store.getRaw(BASE_URL)).toEqual(API_KEY_CREDS);
    });

    it('returns raw bearer credentials', () => {
      store.set(BASE_URL, BEARER_CREDS, {});
      expect(store.getRaw(BASE_URL)).toEqual(BEARER_CREDS);
    });

    it('returns raw oauth2 credentials', () => {
      store.set(BASE_URL, OAUTH_CREDS, {});
      expect(store.getRaw(BASE_URL)).toEqual(OAUTH_CREDS);
    });

    it('returns undefined for an unknown baseUrl', () => {
      expect(store.getRaw('https://unknown.com')).toBeUndefined();
    });
  });

  // ── has ─────────────────────────────────────────────────────────────────────

  describe('has', () => {
    it('returns true after setting credentials', () => {
      store.set(BASE_URL, BEARER_CREDS, {});
      expect(store.has(BASE_URL)).toBe(true);
    });

    it('returns false for an unknown baseUrl', () => {
      expect(store.has('https://unknown.com')).toBe(false);
    });

    it('returns false after clearing credentials', () => {
      store.set(BASE_URL, BEARER_CREDS, {});
      store.clear(BASE_URL);
      expect(store.has(BASE_URL)).toBe(false);
    });
  });

  // ── clear ───────────────────────────────────────────────────────────────────

  describe('clear', () => {
    it('removes credentials from memory', () => {
      store.set(BASE_URL, BEARER_CREDS, {});
      store.clear(BASE_URL);
      expect(store.getRaw(BASE_URL)).toBeUndefined();
    });

    it('get returns null after clear', () => {
      store.set(BASE_URL, BEARER_CREDS, {});
      store.clear(BASE_URL);
      expect(store.get(BASE_URL)).toBeNull();
    });

    it('is a no-op for an unknown baseUrl', () => {
      expect(() => store.clear('https://unknown.com')).not.toThrow();
    });
  });

  // ── TTL expiration ──────────────────────────────────────────────────────────

  describe('TTL expiration', () => {
    it('auto-removes entry after ttlMs elapses', () => {
      store.set(BASE_URL, BEARER_CREDS, { ttlMs: 5_000 });
      expect(store.has(BASE_URL)).toBe(true);
      vi.advanceTimersByTime(5_001);
      expect(store.has(BASE_URL)).toBe(false);
    });

    it('entry is still present just before ttlMs elapses', () => {
      store.set(BASE_URL, BEARER_CREDS, { ttlMs: 5_000 });
      vi.advanceTimersByTime(4_999);
      expect(store.has(BASE_URL)).toBe(true);
    });

    it('calls onExpired callback when TTL fires', () => {
      const onExpired = vi.fn();
      store.set(BASE_URL, BEARER_CREDS, { ttlMs: 3_000, onExpired });
      vi.advanceTimersByTime(3_001);
      expect(onExpired).toHaveBeenCalledOnce();
    });

    it('does NOT call onExpired if entry is cleared before TTL fires', () => {
      const onExpired = vi.fn();
      store.set(BASE_URL, BEARER_CREDS, { ttlMs: 3_000, onExpired });
      store.clear(BASE_URL);
      vi.advanceTimersByTime(5_000);
      expect(onExpired).not.toHaveBeenCalled();
    });
  });

  // ── Refresh timer ───────────────────────────────────────────────────────────

  describe('refresh timer', () => {
    it('fires onRefresh 60 000 ms before TTL expiry', () => {
      const onRefresh = vi.fn();
      store.set(BASE_URL, BEARER_CREDS, { ttlMs: 120_000, onRefresh });
      // Before refresh window: no call
      vi.advanceTimersByTime(59_999);
      expect(onRefresh).not.toHaveBeenCalled();
      // After 60 s mark: fires once
      vi.advanceTimersByTime(1);
      expect(onRefresh).toHaveBeenCalledOnce();
    });

    it('does NOT set refresh timer when ttlMs <= 60 000', () => {
      const onRefresh = vi.fn();
      store.set(BASE_URL, BEARER_CREDS, { ttlMs: 60_000, onRefresh });
      vi.advanceTimersByTime(70_000);
      expect(onRefresh).not.toHaveBeenCalled();
    });

    it('does NOT set refresh timer when onRefresh is not provided', () => {
      // Should not throw; entry should still expire normally
      store.set(BASE_URL, BEARER_CREDS, { ttlMs: 120_000 });
      expect(() => vi.advanceTimersByTime(120_001)).not.toThrow();
    });
  });

  // ── keytar persistence ──────────────────────────────────────────────────────

  describe('keytar persistence', () => {
    it('calls keytar.setPassword when persist=true', async () => {
      store.set(BASE_URL, BEARER_CREDS, { persist: true });
      await flushMicrotasks();
      expect(mockSetPassword).toHaveBeenCalledWith('experience-ui', BASE_URL, expect.any(String));
    });

    it('does NOT call keytar.setPassword when persist is omitted', async () => {
      store.set(BASE_URL, BEARER_CREDS, {});
      await flushMicrotasks();
      expect(mockSetPassword).not.toHaveBeenCalled();
    });

    it('persisted JSON contains the serialized credentials', async () => {
      store.set(BASE_URL, BEARER_CREDS, { persist: true });
      await flushMicrotasks();
      const [, , json] = mockSetPassword.mock.calls[0] as [string, string, string];
      expect(JSON.parse(json)).toEqual(BEARER_CREDS);
    });

    it('calls keytar.deletePassword when clearPersisted=true', async () => {
      store.set(BASE_URL, BEARER_CREDS, {});
      store.clear(BASE_URL, true);
      await flushMicrotasks();
      expect(mockDeletePassword).toHaveBeenCalledWith('experience-ui', BASE_URL);
    });

    it('does NOT call keytar.deletePassword when clearPersisted=false', async () => {
      store.set(BASE_URL, BEARER_CREDS, {});
      store.clear(BASE_URL, false);
      await flushMicrotasks();
      expect(mockDeletePassword).not.toHaveBeenCalled();
    });

    it('does NOT call keytar.deletePassword when clearPersisted is omitted', async () => {
      store.set(BASE_URL, BEARER_CREDS, {});
      store.clear(BASE_URL);
      await flushMicrotasks();
      expect(mockDeletePassword).not.toHaveBeenCalled();
    });
  });
});
