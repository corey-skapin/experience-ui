// src/renderer/stores/auth-store.test.ts
// T045 — RED tests for useAuthStore.
// All tests must fail until the implementation is complete (T050).

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Mock window.experienceUI ────────────────────────────────────────────────

type TokenExpiredCb = (event: { baseUrl: string; reason: string }) => void;
type StatusChangedCb = (event: {
  baseUrl: string;
  status: string;
  responseTimeMs?: number;
}) => void;

let capturedTokenExpiredCb: TokenExpiredCb | null = null;
let capturedStatusChangedCb: StatusChangedCb | null = null;

const mockOnTokenExpired = vi.fn((cb: TokenExpiredCb) => {
  capturedTokenExpiredCb = cb;
  return vi.fn(); // unsubscribe
});

const mockOnConnectionStatusChanged = vi.fn((cb: StatusChangedCb) => {
  capturedStatusChangedCb = cb;
  return vi.fn(); // unsubscribe
});

beforeEach(() => {
  capturedTokenExpiredCb = null;
  capturedStatusChangedCb = null;

  Object.defineProperty(window, 'experienceUI', {
    value: {
      auth: {
        configure: vi.fn(),
        testConnection: vi.fn(),
        getConnectionStatus: vi.fn(),
        startOAuthFlow: vi.fn(),
        clearCredentials: vi.fn(),
        onTokenExpired: mockOnTokenExpired,
        onTokenRefreshed: vi.fn(() => vi.fn()),
        onConnectionStatusChanged: mockOnConnectionStatusChanged,
      },
      cli: {
        sendMessage: vi.fn(),
        getStatus: vi.fn(),
        restart: vi.fn(),
        onStatusChanged: vi.fn(() => vi.fn()),
        onStreamResponse: vi.fn(() => vi.fn()),
      },
      proxy: { apiRequest: vi.fn() },
      app: { getVersion: vi.fn(), compileCode: vi.fn(), validateCode: vi.fn() },
      versions: { saveSnapshot: vi.fn(), list: vi.fn(), loadCode: vi.fn(), getDiff: vi.fn() },
      plugins: {
        install: vi.fn(),
        uninstall: vi.fn(),
        list: vi.fn(),
        onStatusChanged: vi.fn(() => vi.fn()),
      },
    },
    configurable: true,
    writable: true,
  });
});

// ─── Import AFTER mocks ───────────────────────────────────────────────────────

import { useAuthStore } from './auth-store';

// ─── Reset store between tests ───────────────────────────────────────────────

beforeEach(() => {
  useAuthStore.setState({ connections: {} });
  vi.clearAllMocks();
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('useAuthStore', () => {
  describe('initial state', () => {
    it('connections is empty by default', () => {
      expect(useAuthStore.getState().connections).toEqual({});
    });
  });

  describe('setStatus', () => {
    it('adds a new entry for a baseUrl', () => {
      useAuthStore.getState().setStatus('https://api.example.com', 'connected');
      expect(useAuthStore.getState().connections['https://api.example.com']).toBe('connected');
    });

    it('updates an existing entry', () => {
      useAuthStore.getState().setStatus('https://api.example.com', 'connecting');
      useAuthStore.getState().setStatus('https://api.example.com', 'connected');
      expect(useAuthStore.getState().connections['https://api.example.com']).toBe('connected');
    });

    it('stores statuses for multiple independent baseUrls', () => {
      useAuthStore.getState().setStatus('https://api.example.com', 'connected');
      useAuthStore.getState().setStatus('https://other.com', 'expired');
      expect(useAuthStore.getState().connections['https://api.example.com']).toBe('connected');
      expect(useAuthStore.getState().connections['https://other.com']).toBe('expired');
    });
  });

  describe('getStatus', () => {
    it('returns the stored status for a known baseUrl', () => {
      useAuthStore.getState().setStatus('https://api.example.com', 'degraded');
      expect(useAuthStore.getState().getStatus('https://api.example.com')).toBe('degraded');
    });

    it('returns "disconnected" for an unknown baseUrl', () => {
      expect(useAuthStore.getState().getStatus('https://unknown.com')).toBe('disconnected');
    });
  });

  describe('removeConnection', () => {
    it('removes the entry for a baseUrl', () => {
      useAuthStore.getState().setStatus('https://api.example.com', 'connected');
      useAuthStore.getState().removeConnection('https://api.example.com');
      expect(useAuthStore.getState().connections['https://api.example.com']).toBeUndefined();
    });

    it('is a no-op for an unknown baseUrl', () => {
      expect(() => useAuthStore.getState().removeConnection('https://unknown.com')).not.toThrow();
    });
  });

  describe('push notification subscriptions', () => {
    it('initialize() subscribes to token-expired and connection-status-changed events', () => {
      const unsubscribe = useAuthStore.getState().initialize();
      expect(mockOnTokenExpired).toHaveBeenCalledOnce();
      expect(mockOnConnectionStatusChanged).toHaveBeenCalledOnce();
      unsubscribe();
    });

    it('sets status to "expired" when auth:token-expired fires', () => {
      useAuthStore.getState().setStatus('https://api.example.com', 'connected');
      useAuthStore.getState().initialize();

      capturedTokenExpiredCb?.({ baseUrl: 'https://api.example.com', reason: 'expired' });

      expect(useAuthStore.getState().getStatus('https://api.example.com')).toBe('expired');
    });

    it('updates status when auth:connection-status-changed fires', () => {
      useAuthStore.getState().setStatus('https://api.example.com', 'connecting');
      useAuthStore.getState().initialize();

      capturedStatusChangedCb?.({ baseUrl: 'https://api.example.com', status: 'connected' });

      expect(useAuthStore.getState().getStatus('https://api.example.com')).toBe('connected');
    });

    it('returns a cleanup function that unsubscribes from both events', () => {
      const unsub1 = vi.fn();
      const unsub2 = vi.fn();
      mockOnTokenExpired.mockReturnValueOnce(unsub1);
      mockOnConnectionStatusChanged.mockReturnValueOnce(unsub2);

      const unsubscribe = useAuthStore.getState().initialize();
      unsubscribe();

      expect(unsub1).toHaveBeenCalledOnce();
      expect(unsub2).toHaveBeenCalledOnce();
    });
  });

  describe('state reset between tests', () => {
    it('connections should be empty at the start of this test', () => {
      // Verifies beforeEach reset worked
      expect(Object.keys(useAuthStore.getState().connections)).toHaveLength(0);
    });
  });
});
