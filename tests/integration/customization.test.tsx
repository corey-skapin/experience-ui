/**
 * Integration test for the customization flow (User Story 3).
 * Tests: queue sequencing, clarification handling, and store state
 * after customization requests.
 *
 * Uses store state assertions (not DOM) per the virtualizer constraint.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, act, waitFor } from '@testing-library/react'
import App from '../../src/renderer/App'
import { useTabStore } from '../../src/renderer/stores/tab-store'
import {
  customizationQueue,
  type CustomizationQueueResult,
} from '../../src/renderer/services/customization-queue'

// ─── Fixtures ─────────────────────────────────────────────────────────────

const VALID_OPENAPI_SPEC = JSON.stringify({
  openapi: '3.0.0',
  info: { title: 'Pets API', version: '1.0.0' },
  paths: {
    '/pets': {
      get: { operationId: 'listPets', responses: { '200': { description: 'OK' } } },
    },
  },
})

// ─── Mocks ────────────────────────────────────────────────────────────────

const mockSendMessage = vi.fn()
const mockCompileCode = vi.fn()
const mockValidateCode = vi.fn()

function setupBridge(sendMessageImpl = mockSendMessage) {
  Object.defineProperty(window, 'experienceUI', {
    value: {
      cli: {
        sendMessage: sendMessageImpl,
        getStatus: vi.fn().mockResolvedValue({
          status: 'running',
          pid: 1,
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
}

// ─── Setup ────────────────────────────────────────────────────────────────

beforeEach(() => {
  mockSendMessage.mockReset()
  mockCompileCode.mockReset()
  mockValidateCode.mockReset()

  mockCompileCode.mockResolvedValue({
    success: true,
    compiledCode: 'var UI = function(){return null;}',
  })
  mockValidateCode.mockResolvedValue({ safe: true, violations: [], violationCount: 0 })

  // Default sendMessage → generation response
  mockSendMessage.mockResolvedValue({
    success: true,
    requestId: 'req-gen',
    response: JSON.stringify({
      code: 'function App(){return <div>Generated</div>;}',
      description: 'Generated Pets interface',
      componentCount: 2,
    }),
  })

  useTabStore.getState().reset()
  customizationQueue.clear()
  setupBridge()
})

afterEach(() => {
  vi.clearAllMocks()
})

// ─── Queue sequencing ──────────────────────────────────────────────────────

describe('Customization queue sequencing', () => {
  it('processes only one customization at a time (queue blocks concurrent)', async () => {
    render(<App />)

    // Inject a spec so the interface is "ready"
    await act(async () => {
      useTabStore.getState().setApiSpec({
        id: 'spec-1',
        format: 'openapi3',
        source: { type: 'text' },
        rawContent: VALID_OPENAPI_SPEC,
        normalizedSpec: {
          format: 'openapi3',
          metadata: { title: 'Pets API', version: '1.0.0' },
          endpoints: [],
          models: [],
        },
        validationStatus: 'valid',
        metadata: { title: 'Pets API', version: '1.0.0' },
        parsedAt: Date.now(),
      })
      useTabStore.getState().setTabStatus('interface-ready')
    })

    // Enqueue two customization requests directly through the queue service
    let req1Resolve: (v: CustomizationQueueResult) => void
    const req1Promise = new Promise<CustomizationQueueResult>((res) => {
      req1Resolve = res
    })
    const processor1 = vi.fn().mockReturnValue(req1Promise)
    const processor2 = vi.fn().mockResolvedValue({ success: true })

    const { enqueueCustomization } = useTabStore.getState()

    const makeReq = (id: string) => ({
      id,
      tabId: 'tab-1',
      prompt: `prompt-${id}`,
      status: 'queued' as const,
      chatMessageId: `msg-${id}`,
      resultVersionId: null,
      errorMessage: null,
      queuedAt: Date.now(),
      startedAt: null,
      completedAt: null,
    })

    const req1 = makeReq('req-1')
    const req2 = makeReq('req-2')

    await act(async () => {
      enqueueCustomization(req1)
      enqueueCustomization(req2)
      customizationQueue.enqueue(req1, processor1)
      customizationQueue.enqueue(req2, processor2)
    })

    // After microtasks flush: req-1 should be in-progress, req-2 should be queued
    await act(async () => {
      await Promise.resolve()
    })

    expect(customizationQueue.getStatus('req-1')).toBe('in-progress')
    expect(customizationQueue.getStatus('req-2')).toBe('queued')
    expect(processor1).toHaveBeenCalledTimes(1)
    expect(processor2).toHaveBeenCalledTimes(0)

    // Unblock req-1
    await act(async () => {
      req1Resolve({ success: true })
      await Promise.resolve()
      await Promise.resolve()
    })

    // req-2 should now start
    await waitFor(() => {
      expect(customizationQueue.getStatus('req-1')).toBe('completed')
      expect(processor2).toHaveBeenCalledTimes(1)
    })
  })

  it('processes the second request after the first completes', async () => {
    const order: string[] = []
    const makeProcessor = (id: string) =>
      vi.fn().mockImplementation(() => {
        order.push(id)
        return Promise.resolve({ success: true })
      })

    const makeReq = (id: string) => ({
      id,
      tabId: 'tab-1',
      prompt: `p${id}`,
      status: 'queued' as const,
      chatMessageId: `m${id}`,
      resultVersionId: null,
      errorMessage: null,
      queuedAt: Date.now(),
      startedAt: null,
      completedAt: null,
    })

    const r1 = makeReq('q1')
    const r2 = makeReq('q2')
    const r3 = makeReq('q3')

    await act(async () => {
      await Promise.all([
        customizationQueue.enqueue(r1, makeProcessor('q1')),
        customizationQueue.enqueue(r2, makeProcessor('q2')),
        customizationQueue.enqueue(r3, makeProcessor('q3')),
      ])
    })

    expect(order).toEqual(['q1', 'q2', 'q3'])
  })
})

// ─── Clarification handling ────────────────────────────────────────────────

describe('Clarification handling', () => {
  it('returns clarificationNeeded result from queue when CLI requests it', async () => {
    const req = {
      id: 'clarify-1',
      tabId: 'tab-1',
      prompt: 'Add a search bar',
      status: 'queued' as const,
      chatMessageId: 'msg-clarify',
      resultVersionId: null,
      errorMessage: null,
      queuedAt: Date.now(),
      startedAt: null,
      completedAt: null,
    }

    const clarifyProcessor = vi.fn().mockResolvedValue({
      success: true,
      clarificationNeeded: true,
      question: 'Which table?',
      options: ['Users', 'Orders'],
    })

    const result = await act(async () => {
      return customizationQueue.enqueue(req, clarifyProcessor)
    })

    expect(result.success).toBe(true)
    expect(result.clarificationNeeded).toBe(true)
    expect(result.question).toBe('Which table?')
    expect(result.options).toEqual(['Users', 'Orders'])

    // Original request should be marked completed in the queue
    expect(customizationQueue.getStatus('clarify-1')).toBe('completed')
  })
})

// ─── Store state assertions ────────────────────────────────────────────────

describe('Store state after customization', () => {
  it('enqueued request appears in tab customizationQueue', async () => {
    const req = {
      id: 'store-1',
      tabId: 'tab-1',
      prompt: 'Update button styles',
      status: 'queued' as const,
      chatMessageId: 'msg-1',
      resultVersionId: null,
      errorMessage: null,
      queuedAt: Date.now(),
      startedAt: null,
      completedAt: null,
    }

    act(() => {
      useTabStore.getState().enqueueCustomization(req)
    })

    const { customizationQueue: storeQueue } = useTabStore.getState().tab
    expect(storeQueue).toHaveLength(1)
    expect(storeQueue[0].id).toBe('store-1')
    expect(storeQueue[0].status).toBe('queued')
  })

  it('store reflects completed status after processing', async () => {
    const req = {
      id: 'store-2',
      tabId: 'tab-1',
      prompt: 'Make headers bigger',
      status: 'queued' as const,
      chatMessageId: 'msg-2',
      resultVersionId: null,
      errorMessage: null,
      queuedAt: Date.now(),
      startedAt: null,
      completedAt: null,
    }

    act(() => {
      useTabStore.getState().enqueueCustomization(req)
    })

    await act(async () => {
      await customizationQueue.enqueue(req, async () => {
        useTabStore.getState().updateCustomization(req.id, {
          status: 'completed',
          completedAt: Date.now(),
        })
        return { success: true }
      })
    })

    const { customizationQueue: storeQueue } = useTabStore.getState().tab
    const done = storeQueue.find((r) => r.id === 'store-2')
    expect(done?.status).toBe('completed')
  })

  it('queue depth limit is enforced — overflow returns error', async () => {
    // Keep req-1 in-progress
    let resolve1: (v: CustomizationQueueResult) => void
    const pendingPromise = new Promise<CustomizationQueueResult>((r) => {
      resolve1 = r
    })

    const makeReq = (id: string) => ({
      id,
      tabId: 'tab-1',
      prompt: `p${id}`,
      status: 'queued' as const,
      chatMessageId: `m${id}`,
      resultVersionId: null,
      errorMessage: null,
      queuedAt: Date.now(),
      startedAt: null,
      completedAt: null,
    })

    // Start req-1 (blocking)
    customizationQueue.enqueue(makeReq('d-1'), () => pendingPromise)

    // Wait for req-1 to start
    await act(async () => {
      await Promise.resolve()
    })

    // Fill remaining 9 slots
    for (let i = 2; i <= 10; i++) {
      customizationQueue.enqueue(makeReq(`d-${i}`), () => Promise.resolve({ success: true }))
    }

    // Overflow — should fail immediately
    const overflow = await act(async () =>
      customizationQueue.enqueue(makeReq('d-overflow'), () => Promise.resolve({ success: true })),
    )

    expect(overflow.success).toBe(false)
    expect(overflow.error).toMatch(/full/i)

    resolve1({ success: true })
  })
})
