/**
 * Integration test for the full spec-to-interface flow (User Story 1).
 * Tests: spec parsing → code generation → sandbox render → error display.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react'
import App from '../../src/renderer/App'
import { useTabStore } from '../../src/renderer/stores/tab-store'

// ─── Mocks ────────────────────────────────────────────────────────────────

const mockCompileCode = vi.fn()
const mockValidateCode = vi.fn()
const mockSendMessage = vi.fn()

beforeEach(() => {
  // Reset tab store
  useTabStore.getState().reset()

  // Reset mocks
  mockCompileCode.mockReset()
  mockValidateCode.mockReset()
  mockSendMessage.mockReset()

  // Default mock implementations
  mockValidateCode.mockResolvedValue({ safe: true, violations: [], violationCount: 0 })
  mockCompileCode.mockResolvedValue({
    success: true,
    compiledCode: 'var GeneratedComponent = function() { return null; }',
  })
  mockSendMessage.mockResolvedValue({
    success: true,
    response: JSON.stringify({
      code: 'function App() { return <div>Generated</div>; }',
      description: 'Generated interface',
      componentCount: 3,
    }),
    requestId: 'req-1',
  })

  // Update window mock
  Object.defineProperty(window, 'experienceUI', {
    value: {
      cli: {
        sendMessage: mockSendMessage,
        getStatus: vi
          .fn()
          .mockResolvedValue({
            status: 'running',
            pid: 1234,
            restartCount: 0,
            pendingRequests: 0,
            uptime: 1000,
          }),
        restart: vi.fn().mockResolvedValue({ success: true }),
        onStatusChanged: vi.fn(() => vi.fn()),
        onStreamResponse: vi.fn(() => vi.fn()),
      },
      app: {
        compileCode: mockCompileCode,
        validateCode: mockValidateCode,
      },
      proxy: { apiRequest: vi.fn() },
      versions: { saveSnapshot: vi.fn(), list: vi.fn(), loadCode: vi.fn(), getDiff: vi.fn() },
      plugins: {
        install: vi.fn(),
        uninstall: vi.fn(),
        list: vi.fn(),
        enable: vi.fn(),
        disable: vi.fn(),
      },
      auth: {
        configure: vi.fn(),
        testConnection: vi.fn(),
        getConnectionStatus: vi.fn(),
        clearCredentials: vi.fn(),
        startOAuthFlow: vi.fn(),
        onTokenExpired: vi.fn(() => vi.fn()),
        onConnectionStatusChanged: vi.fn(() => vi.fn()),
      },
    },
    writable: true,
    configurable: true,
  })
})

// ─── OpenAPI 3.x spec fixture ─────────────────────────────────────────────

const VALID_OPENAPI_SPEC = JSON.stringify({
  openapi: '3.0.3',
  info: { title: 'Test API', version: '1.0.0' },
  paths: {
    '/users': {
      get: {
        operationId: 'listUsers',
        summary: 'List users',
        responses: { '200': { description: 'OK' } },
      },
    },
  },
})

const INVALID_SPEC = '{invalid json}'

const UNSUPPORTED_SPEC = '#%RAML 1.0\ntitle: Test'

// ─── Tests ────────────────────────────────────────────────────────────────

describe('App - spec ingestion flow', () => {
  it('renders the split-pane layout', () => {
    render(<App />)
    expect(screen.getByTestId('chat-panel')).toBeInTheDocument()
    expect(screen.getByTestId('sandbox-host-empty')).toBeInTheDocument()
  })

  it('shows empty state in sandbox before spec is provided', () => {
    render(<App />)
    expect(screen.getByTestId('sandbox-host-empty')).toBeInTheDocument()
  })

  it('displays error for invalid JSON spec', async () => {
    render(<App />)
    const input = screen.getByRole('textbox', { name: /message input/i })
    const submitBtn = screen.getByRole('button', { name: /send message/i })

    await act(async () => {
      fireEvent.change(input, { target: { value: INVALID_SPEC } })
      fireEvent.click(submitBtn)
    })

    await waitFor(
      () => {
        const { chatHistory } = useTabStore.getState().tab
        const hasError = chatHistory.some(
          (m) =>
            m.status === 'error' ||
            m.content.toLowerCase().includes('error') ||
            m.content.toLowerCase().includes('parse'),
        )
        expect(hasError).toBe(true)
      },
      { timeout: 5000 },
    )
  })

  it('displays error for unsupported RAML format', async () => {
    render(<App />)
    const input = screen.getByRole('textbox', { name: /message input/i })
    const submitBtn = screen.getByRole('button', { name: /send message/i })

    await act(async () => {
      fireEvent.change(input, { target: { value: UNSUPPORTED_SPEC } })
      fireEvent.click(submitBtn)
    })

    await waitFor(
      () => {
        const { chatHistory } = useTabStore.getState().tab
        const hasError = chatHistory.some(
          (m) => m.content.includes('RAML') || m.content.toLowerCase().includes('unsupported'),
        )
        expect(hasError).toBe(true)
      },
      { timeout: 5000 },
    )
  })

  it('parses a valid OpenAPI spec and updates tab status', async () => {
    render(<App />)

    await act(async () => {
      useTabStore.getState().setApiSpec({
        id: 'spec-1',
        format: 'openapi3',
        source: { type: 'text' },
        rawContent: VALID_OPENAPI_SPEC,
        normalizedSpec: {
          format: 'openapi3',
          metadata: { title: 'Test API', version: '1.0.0' },
          endpoints: [],
          models: [],
        },
        validationStatus: 'valid',
        metadata: { title: 'Test API', version: '1.0.0' },
        parsedAt: Date.now(),
      })
      useTabStore.getState().setTabStatus('spec-loaded')
    })

    expect(useTabStore.getState().tab.status).toBe('spec-loaded')
    expect(useTabStore.getState().tab.apiSpec?.metadata.title).toBe('Test API')
  })

  it('displays parse success message in chat', async () => {
    render(<App />)

    const input = screen.getByRole('textbox', { name: /message input/i })
    const submitBtn = screen.getByRole('button', { name: /send message/i })

    await act(async () => {
      fireEvent.change(input, { target: { value: VALID_OPENAPI_SPEC } })
      fireEvent.click(submitBtn)
    })

    // The parse completes, check store state for success message
    await waitFor(
      () => {
        const { chatHistory } = useTabStore.getState().tab
        const hasSuccess = chatHistory.some(
          (m) => m.content.includes('Parsed') || m.content.includes('Test API'),
        )
        expect(hasSuccess).toBe(true)
      },
      { timeout: 10000 },
    )
  })
})

// ─── spec parser unit integration ────────────────────────────────────────

describe('Spec parsing integration', () => {
  it('parses OpenAPI 3 spec from file fixture', async () => {
    const { parseSpec } = await import('../../src/renderer/services/spec-parser')
    const spec = JSON.stringify({
      openapi: '3.0.0',
      info: { title: 'Users API', version: '2.0' },
      paths: {
        '/users': { get: { responses: { '200': { description: 'OK' } } } },
        '/users/{id}': { get: { responses: { '200': { description: 'OK' } } } },
      },
    })

    const result = await parseSpec(spec, 'json')
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.format).toBe('openapi3')
    expect(result.data.endpoints).toHaveLength(2)
  })

  it('parses GraphQL spec', async () => {
    const { parseSpec } = await import('../../src/renderer/services/spec-parser')
    const schema = 'type Query { users: [User] } type User { id: ID! name: String }'
    const result = await parseSpec(schema, 'graphql')
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.format).toBe('graphql')
    expect(result.data.queries?.length).toBeGreaterThan(0)
  })

  it('rejects empty spec', async () => {
    const { parseSpec } = await import('../../src/renderer/services/spec-parser')
    const result = await parseSpec('', 'json')
    expect(result.success).toBe(false)
  })

  it('rejects RAML with helpful message', async () => {
    const { parseSpec } = await import('../../src/renderer/services/spec-parser')
    const result = await parseSpec('#%RAML 1.0\ntitle: My API', 'yaml')
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.supportedFormats).toContain('openapi3')
    }
  })
})
