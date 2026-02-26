/**
 * Unit tests for the `customize` method added to the useCli hook.
 * Tests: CLI request formatting, streaming, clarification handling.
 *
 * Written FIRST (TDD) — must fail before the implementation exists.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useCli, type CustomizeResult } from './use-cli'
import type { NormalizedSpec, ChatMessage } from '../../shared/types'

// ─── Fixtures ─────────────────────────────────────────────────────────────

const STUB_SPEC: NormalizedSpec = {
  format: 'openapi3',
  metadata: { title: 'Test API', version: '1.0.0' },
  endpoints: [],
  models: [],
}

const STUB_HISTORY: ChatMessage[] = [
  {
    id: 'msg-1',
    tabId: 'tab-1',
    role: 'user',
    content: 'Generate an interface',
    timestamp: 1000,
    status: 'sent',
    relatedVersionId: null,
  },
]

// ─── Setup ────────────────────────────────────────────────────────────────

const mockSendMessage = vi.fn()

beforeEach(() => {
  mockSendMessage.mockReset()

  Object.defineProperty(window, 'experienceUI', {
    value: {
      cli: {
        sendMessage: mockSendMessage,
        getStatus: vi.fn().mockResolvedValue({
          status: 'running',
          pid: 1,
          restartCount: 0,
          pendingRequests: 0,
          uptime: 100,
        }),
        restart: vi.fn(),
        onStatusChanged: vi.fn(() => vi.fn()),
        onStreamResponse: vi.fn(() => vi.fn()),
      },
      app: { compileCode: vi.fn(), validateCode: vi.fn() },
      auth: {
        configure: vi.fn(),
        testConnection: vi.fn(),
        getConnectionStatus: vi.fn(),
        clearCredentials: vi.fn(),
        startOAuthFlow: vi.fn(),
        onTokenExpired: vi.fn(() => vi.fn()),
        onConnectionStatusChanged: vi.fn(() => vi.fn()),
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
    },
    writable: true,
    configurable: true,
  })
})

// ─── Tests ────────────────────────────────────────────────────────────────

describe('customize method', () => {
  it('sends a customize JSON-RPC request through the CLI', async () => {
    mockSendMessage.mockResolvedValue({
      success: true,
      requestId: 'req-1',
      response: JSON.stringify({
        code: 'function App() { return <div>updated</div>; }',
        description: 'Added search bar',
        assumptions: ['Filtering is client-side'],
        clarificationNeeded: false,
      }),
    })

    const { result } = renderHook(() => useCli())

    let response: CustomizeResult | undefined
    await act(async () => {
      response = await result.current.customize(
        'tab-1',
        'Add a search bar',
        '<code/>',
        STUB_SPEC,
        STUB_HISTORY,
      )
    })

    expect(mockSendMessage).toHaveBeenCalledTimes(1)
    const callArg = mockSendMessage.mock.calls[0][0]
    const parsed = JSON.parse(callArg.message as string) as Record<string, unknown>
    expect(parsed).toMatchObject({
      jsonrpc: '2.0',
      method: 'customize',
    })
    const params = parsed.params as Record<string, unknown>
    expect(params.prompt).toBe('Add a search bar')
    expect(params.currentCode).toBe('<code/>')
    expect(params.spec).toEqual(STUB_SPEC)
    expect(Array.isArray(params.history)).toBe(true)

    expect(response?.success).toBe(true)
  })

  it('returns the parsed CLI result including code and description', async () => {
    mockSendMessage.mockResolvedValue({
      success: true,
      requestId: 'req-1',
      response: JSON.stringify({
        code: 'function App() { return <div>new</div>; }',
        description: 'Added filter',
        assumptions: ['Client-side'],
        clarificationNeeded: false,
      }),
    })

    const { result } = renderHook(() => useCli())

    let response: CustomizeResult | undefined
    await act(async () => {
      response = await result.current.customize('tab-1', 'Add filter', '<code/>', STUB_SPEC, [])
    })

    expect(response?.success).toBe(true)
    if (!response?.success) return
    expect(response.clarificationNeeded).toBe(false)
    if (response.clarificationNeeded) return
    expect(response.code).toBe('function App() { return <div>new</div>; }')
    expect(response.description).toBe('Added filter')
    expect(response.assumptions).toEqual(['Client-side'])
  })

  it('detects and surfaces clarification responses', async () => {
    mockSendMessage.mockResolvedValue({
      success: true,
      requestId: 'req-1',
      response: JSON.stringify({
        code: null,
        clarificationNeeded: true,
        question: 'Which table should I add the search to?',
        options: ['Users', 'Orders'],
      }),
    })

    const { result } = renderHook(() => useCli())

    let response: CustomizeResult | undefined
    await act(async () => {
      response = await result.current.customize(
        'tab-1',
        'Add a search bar',
        '<code/>',
        STUB_SPEC,
        [],
      )
    })

    expect(response?.success).toBe(true)
    if (!response?.success) return
    expect(response.clarificationNeeded).toBe(true)
    if (!response.clarificationNeeded) return
    expect(response.question).toBe('Which table should I add the search to?')
    expect(response.options).toEqual(['Users', 'Orders'])
  })

  it('returns success: false when CLI call fails', async () => {
    mockSendMessage.mockResolvedValue({
      success: false,
      requestId: 'req-1',
      error: 'CLI unavailable',
    })

    const { result } = renderHook(() => useCli())

    let response: CustomizeResult | undefined
    await act(async () => {
      response = await result.current.customize('tab-1', 'Add search', '<code/>', STUB_SPEC, [])
    })

    expect(response?.success).toBe(false)
    if (response?.success) return
    expect(response?.error).toMatch(/CLI unavailable/i)
  })

  it('passes chat history mapped to {role, content} pairs', async () => {
    mockSendMessage.mockResolvedValue({
      success: true,
      requestId: 'req-1',
      response: JSON.stringify({
        code: 'x',
        description: 'd',
        assumptions: [],
        clarificationNeeded: false,
      }),
    })

    const { result } = renderHook(() => useCli())

    await act(async () => {
      await result.current.customize('tab-1', 'prompt', '<code/>', STUB_SPEC, STUB_HISTORY)
    })

    const callArg = mockSendMessage.mock.calls[0][0]
    const parsed = JSON.parse(callArg.message as string) as Record<string, unknown>
    const params = parsed.params as { history: Array<{ role: string; content: string }> }
    expect(params.history).toEqual([{ role: 'user', content: 'Generate an interface' }])
  })
})
