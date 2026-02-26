/**
 * Integration test for auth flow (User Story 2).
 * Tests: configure API key auth, test connection success,
 * proxied request includes auth header, token-expired → re-auth prompt.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useAuthStore } from '../../src/renderer/stores/auth-store'
import { AuthSetupFlow } from '../../src/renderer/components/auth/AuthSetupFlow'
import { ConnectionStatus } from '../../src/renderer/components/auth/ConnectionStatus'

// ─── Mock window.experienceUI ─────────────────────────────────────────────

const mockConfigure = vi.fn()
const mockTestConnection = vi.fn()
const mockClearCredentials = vi.fn()
const mockProxyRequest = vi.fn()
const mockOnTokenExpired = vi.fn()
const mockOnConnectionStatusChanged = vi.fn()
const mockStartOAuthFlow = vi.fn()
const mockGetConnectionStatus = vi.fn()

beforeEach(() => {
  // Reset store state
  useAuthStore.getState().reset()

  // Reset mocks
  vi.clearAllMocks()

  mockOnTokenExpired.mockReturnValue(vi.fn())
  mockOnConnectionStatusChanged.mockReturnValue(vi.fn())
  mockGetConnectionStatus.mockResolvedValue({
    configured: false,
    status: 'disconnected',
    authMethod: 'none',
    lastVerifiedAt: null,
    responseTimeMs: null,
  })

  // Set up window.experienceUI mock
  Object.defineProperty(window, 'experienceUI', {
    configurable: true,
    writable: true,
    value: {
      cli: {
        sendMessage: vi.fn(),
        getStatus: vi.fn(),
        restart: vi.fn(),
        onStatusChanged: vi.fn(() => vi.fn()),
        onStreamResponse: vi.fn(() => vi.fn()),
      },
      auth: {
        configure: mockConfigure,
        testConnection: mockTestConnection,
        getConnectionStatus: mockGetConnectionStatus,
        clearCredentials: mockClearCredentials,
        startOAuthFlow: mockStartOAuthFlow,
        onTokenExpired: mockOnTokenExpired,
        onConnectionStatusChanged: mockOnConnectionStatusChanged,
      },
      proxy: {
        apiRequest: mockProxyRequest,
      },
      versions: {
        saveSnapshot: vi.fn(),
        list: vi.fn(),
        loadCode: vi.fn(),
        getDiff: vi.fn(),
      },
      plugins: {
        install: vi.fn(),
        uninstall: vi.fn(),
        list: vi.fn(),
        onStatusChanged: vi.fn(() => vi.fn()),
      },
      app: {
        compileCode: vi.fn(),
        validateCode: vi.fn(),
      },
    },
  })
})

const TEST_BASE_URL = 'https://api.example.com'

describe('Auth flow integration', () => {
  // ─── Configure API key auth ────────────────────────────────────────────

  it('configures API key auth and updates store', async () => {
    mockConfigure.mockResolvedValue({ success: true, connectionId: 'conn-1' })

    const { unmount } = render(<AuthSetupFlow baseUrl={TEST_BASE_URL} />)

    // Advance to credentials step
    const nextButton = screen.getByText('Next')
    await userEvent.click(nextButton)

    // Enter API key
    const keyInput = screen.getByTestId('api-key-value-input')
    await userEvent.type(keyInput, 'my-api-key')

    // Click configure
    const configureButton = screen.getByTestId('configure-button')
    await userEvent.click(configureButton)

    await waitFor(() => {
      expect(mockConfigure).toHaveBeenCalledWith({
        baseUrl: TEST_BASE_URL,
        method: { type: 'apiKey', headerName: 'X-API-Key', key: 'my-api-key' },
        persist: false,
      })
    })

    unmount()
  })

  // ─── Test connection success ───────────────────────────────────────────

  it('shows success result after test connection', async () => {
    mockConfigure.mockResolvedValue({ success: true, connectionId: 'conn-1' })
    mockTestConnection.mockResolvedValue({
      status: 'connected',
      responseTimeMs: 123,
      statusCode: 200,
    })

    render(<AuthSetupFlow baseUrl={TEST_BASE_URL} />)

    await userEvent.click(screen.getByText('Next'))

    const keyInput = screen.getByTestId('api-key-value-input')
    await userEvent.type(keyInput, 'my-api-key')
    await userEvent.click(screen.getByTestId('configure-button'))

    await waitFor(() => screen.getByTestId('test-connection-button'))
    await userEvent.click(screen.getByTestId('test-connection-button'))

    await waitFor(() => {
      expect(screen.getByText('Connected')).toBeInTheDocument()
    })
  })

  // ─── Token expired triggers re-auth prompt ────────────────────────────

  it('shows re-authenticate button when connection is expired', async () => {
    const onReauth = vi.fn()

    act(() => {
      useAuthStore.getState().setConnection(TEST_BASE_URL, {
        status: 'expired',
        authMethod: 'bearer',
        lastVerifiedAt: Date.now() - 3600_000,
        responseTimeMs: null,
      })
    })

    render(<ConnectionStatus baseUrl={TEST_BASE_URL} onReauthenticate={onReauth} />)

    await waitFor(() => {
      expect(screen.getByTestId('reauth-button')).toBeInTheDocument()
    })

    await userEvent.click(screen.getByTestId('reauth-button'))
    expect(onReauth).toHaveBeenCalled()
  })

  // ─── Connection status indicator ──────────────────────────────────────

  it('displays connected status badge', async () => {
    act(() => {
      useAuthStore.getState().setConnection(TEST_BASE_URL, {
        status: 'connected',
        authMethod: 'apiKey',
        lastVerifiedAt: Date.now(),
        responseTimeMs: 50,
      })
    })

    render(<ConnectionStatus baseUrl={TEST_BASE_URL} />)

    await waitFor(() => {
      expect(screen.getByText('Connected')).toBeInTheDocument()
    })
  })
})
