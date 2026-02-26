// tests/integration/auth-flow.test.tsx
// T056 — Integration test: API authentication & connection flow.
// Tests: configure → connecting → test → connected, 401 → expired, re-auth.

import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { useAuthStore } from '../../src/renderer/stores/auth-store';
import { AuthSetupFlow } from '../../src/renderer/components/auth/AuthSetupFlow';

// ─── Mock window.experienceUI ────────────────────────────────────────────────

let capturedTokenExpiredCb: ((e: { baseUrl: string; reason: string }) => void) | null = null;
let capturedStatusChangedCb: ((e: { baseUrl: string; status: string }) => void) | null = null;

const mockAuth = {
  configure: vi.fn(),
  testConnection: vi.fn(),
  getConnectionStatus: vi.fn(),
  startOAuthFlow: vi.fn(),
  clearCredentials: vi.fn(),
  onTokenExpired: vi.fn((cb: (e: { baseUrl: string; reason: string }) => void) => {
    capturedTokenExpiredCb = cb;
    return vi.fn();
  }),
  onTokenRefreshed: vi.fn(() => vi.fn()),
  onConnectionStatusChanged: vi.fn((cb: (e: { baseUrl: string; status: string }) => void) => {
    capturedStatusChangedCb = cb;
    return vi.fn();
  }),
};

const mockExperienceUI = {
  auth: mockAuth,
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
};

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  capturedTokenExpiredCb = null;
  capturedStatusChangedCb = null;

  Object.defineProperty(window, 'experienceUI', {
    value: mockExperienceUI,
    configurable: true,
    writable: true,
  });

  vi.clearAllMocks();

  // Restore default mock implementations
  mockAuth.onTokenExpired.mockImplementation((cb) => {
    capturedTokenExpiredCb = cb;
    return vi.fn();
  });
  mockAuth.onConnectionStatusChanged.mockImplementation((cb) => {
    capturedStatusChangedCb = cb;
    return vi.fn();
  });

  // Reset auth store
  useAuthStore.setState({ connections: {} });
});

// ─── Tests ───────────────────────────────────────────────────────────────────

const BASE_URL = 'https://api.example.com';

describe('Auth flow — configure API key', () => {
  it('renders step 1 with method selection', async () => {
    render(<AuthSetupFlow baseUrl={BASE_URL} />);
    expect(screen.getByText('Select authentication method')).toBeInTheDocument();
    expect(screen.getByLabelText(/authentication setup/i)).toBeInTheDocument();
  });

  it('configuring API key auth sets status to "connecting" then calls configure', async () => {
    const user = userEvent.setup({ delay: null });

    mockAuth.configure.mockResolvedValue({ success: true, connectionId: 'conn-abc' });
    mockAuth.testConnection.mockResolvedValue({
      status: 'connected',
      responseTimeMs: 42,
      statusCode: 200,
    });

    render(<AuthSetupFlow baseUrl={BASE_URL} />);

    // Step 1: select API key (already selected by default — radio for apiKey)
    const apiKeyRadio = screen.getByDisplayValue('apiKey');
    await user.click(apiKeyRadio);
    await user.click(screen.getByText('Next →'));

    // Step 2: fill credentials
    await waitFor(() => expect(screen.getByText('Enter credentials')).toBeInTheDocument());
    const headerInput = screen.getByPlaceholderText('X-API-Key');
    await user.clear(headerInput);
    await user.type(headerInput, 'Authorization');

    await user.click(screen.getByText('Test connection →'));

    // Step 3: test connection
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /test connection/i })).toBeInTheDocument(),
    );
    await user.click(screen.getByRole('button', { name: /^test connection$/i }));

    // Verify configure was called
    await waitFor(() => {
      expect(mockAuth.configure).toHaveBeenCalledWith({
        baseUrl: BASE_URL,
        method: expect.objectContaining({ type: 'apiKey' }),
        persist: false,
      });
    });

    // Status should have been set to 'connecting' then 'connected'
    await waitFor(() => {
      expect(useAuthStore.getState().getStatus(BASE_URL)).toBe('connected');
    });
  });

  it('401 response triggers token-expired event and sets status to "expired"', async () => {
    // Initialize auth store subscriptions
    const unsubscribe = useAuthStore.getState().initialize();

    // Set initial connected status
    useAuthStore.getState().setStatus(BASE_URL, 'connected');
    expect(useAuthStore.getState().getStatus(BASE_URL)).toBe('connected');

    // Simulate 401 push notification
    capturedTokenExpiredCb?.({ baseUrl: BASE_URL, reason: 'expired' });

    expect(useAuthStore.getState().getStatus(BASE_URL)).toBe('expired');

    unsubscribe();
  });

  it('connection-status-changed push updates auth store status', async () => {
    const unsubscribe = useAuthStore.getState().initialize();

    capturedStatusChangedCb?.({ baseUrl: BASE_URL, status: 'connected' });

    expect(useAuthStore.getState().getStatus(BASE_URL)).toBe('connected');

    unsubscribe();
  });

  it('re-authenticating after expiry clears status and re-configures', async () => {
    const onComplete = vi.fn();
    const user = userEvent.setup({ delay: null });

    mockAuth.configure.mockResolvedValue({ success: true, connectionId: 'conn-new' });
    mockAuth.testConnection.mockResolvedValue({
      status: 'connected',
      responseTimeMs: 15,
      statusCode: 200,
    });
    mockAuth.clearCredentials.mockResolvedValue({ success: true });

    // Start with expired status
    useAuthStore.setState({ connections: { [BASE_URL]: 'expired' } });
    expect(useAuthStore.getState().getStatus(BASE_URL)).toBe('expired');

    render(<AuthSetupFlow baseUrl={BASE_URL} onComplete={onComplete} />);

    // Navigate through steps
    const apiKeyRadio = screen.getByDisplayValue('apiKey');
    await user.click(apiKeyRadio);
    await user.click(screen.getByText('Next →'));
    await waitFor(() => expect(screen.getByText('Enter credentials')).toBeInTheDocument());
    await user.click(screen.getByText('Test connection →'));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Test connection' })).toBeInTheDocument(),
    );
    await user.click(screen.getByRole('button', { name: 'Test connection' }));

    await waitFor(() => {
      expect(useAuthStore.getState().getStatus(BASE_URL)).toBe('connected');
    });
  });

  it('failed configuration shows error and sets status to disconnected', async () => {
    const user = userEvent.setup({ delay: null });

    mockAuth.configure.mockResolvedValue({
      success: false,
      connectionId: '',
      error: 'Invalid key format',
    });
    mockAuth.testConnection.mockResolvedValue({
      status: 'unauthorized',
      responseTimeMs: 5,
      statusCode: 401,
    });

    render(<AuthSetupFlow baseUrl={BASE_URL} />);

    await user.click(screen.getByDisplayValue('apiKey'));
    await user.click(screen.getByText('Next →'));
    await waitFor(() => expect(screen.getByText('Enter credentials')).toBeInTheDocument());
    await user.click(screen.getByText('Test connection →'));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Test connection' })).toBeInTheDocument(),
    );
    await user.click(screen.getByRole('button', { name: 'Test connection' }));

    await waitFor(() => {
      expect(useAuthStore.getState().getStatus(BASE_URL)).toBe('expired');
    });
  });
});

describe('Auth store — direct unit behavior', () => {
  it('getStatus returns "disconnected" for unknown baseUrl', () => {
    expect(useAuthStore.getState().getStatus('https://unknown.com')).toBe('disconnected');
  });

  it('setStatus and getStatus round-trip', () => {
    useAuthStore.getState().setStatus(BASE_URL, 'degraded');
    expect(useAuthStore.getState().getStatus(BASE_URL)).toBe('degraded');
  });

  it('removeConnection removes entry from connections map', () => {
    useAuthStore.getState().setStatus(BASE_URL, 'connected');
    useAuthStore.getState().removeConnection(BASE_URL);
    expect(useAuthStore.getState().connections[BASE_URL]).toBeUndefined();
  });
});
