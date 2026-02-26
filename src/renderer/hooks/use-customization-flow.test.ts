/**
 * Unit tests for the useCustomizationFlow hook.
 * Tests: queueing requests, processing pipeline, clarification flow,
 * conflict handling, and store state updates.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useTabStore } from '../stores/tab-store'
import { customizationQueue } from '../services/customization-queue'
import type { NormalizedSpec } from '../../shared/types'

// ─── Fixtures ─────────────────────────────────────────────────────────────

const STUB_SPEC: NormalizedSpec = {
  format: 'openapi3',
  metadata: { title: 'Test API', version: '1.0.0' },
  endpoints: [],
  models: [],
}

const STUB_COMPILED_CODE = 'function App(){return null;}'

const mockCustomize = vi.fn()

vi.mock('../hooks/use-cli', () => ({
  useCli: () => ({
    customize: mockCustomize,
    sendMessage: vi.fn(),
    getStatus: vi.fn(),
    restart: vi.fn(),
    status: 'running',
    pid: 1,
    restartCount: 0,
    pendingRequests: 0,
    isLoading: false,
    error: null,
  }),
}))

function successResult(desc = 'Done') {
  return {
    success: true as const,
    clarificationNeeded: false as const,
    code: 'function App(){return <div/>;}',
    description: desc,
    assumptions: [] as string[],
    requestId: 'req-1',
  }
}

beforeEach(() => {
  mockCustomize.mockReset()
  useTabStore.getState().reset()
  customizationQueue.clear()
  useTabStore.getState().setApiSpec({
    id: 'spec-1',
    format: 'openapi3',
    source: { type: 'text' },
    rawContent: '{}',
    normalizedSpec: STUB_SPEC,
    validationStatus: 'valid',
    metadata: STUB_SPEC.metadata,
    parsedAt: Date.now(),
  })
  // The global vitest-setup.ts already mocks window.experienceUI
  // Just configure the app mocks we need
  const bridge = window.experienceUI
  vi.mocked(bridge.app.compileCode).mockResolvedValue({
    success: true,
    compiledCode: 'bundle',
  })
  vi.mocked(bridge.app.validateCode).mockResolvedValue({
    valid: true,
    violations: [],
  })
})

afterEach(() => {
  vi.clearAllMocks()
})

async function renderFlow(compiledCode: string | null = STUB_COMPILED_CODE) {
  const { useCustomizationFlow } = await import('./use-customization-flow')
  return renderHook(() => useCustomizationFlow(compiledCode))
}

// ─── Request enqueueing ────────────────────────────────────────────────────

describe('useCustomizationFlow — request enqueueing', () => {
  it('adds a CustomizationRequest to the store', async () => {
    mockCustomize.mockResolvedValue(successResult())
    const { result } = await renderFlow()
    await act(async () => {
      await result.current.handleCustomizationMessage('Add a search bar')
    })
    await waitFor(() => {
      expect(useTabStore.getState().tab.customizationQueue.length).toBeGreaterThan(0)
    })
  })

  it('adds a user chat message for the prompt', async () => {
    mockCustomize.mockResolvedValue(successResult())
    const { result } = await renderFlow()
    await act(async () => {
      await result.current.handleCustomizationMessage('Make it blue')
    })
    await waitFor(() => {
      const msg = useTabStore
        .getState()
        .tab.chatHistory.find((m) => m.role === 'user' && m.content === 'Make it blue')
      expect(msg).toBeDefined()
    })
  })
})

// ─── Successful customization ──────────────────────────────────────────────

describe('useCustomizationFlow — successful customization', () => {
  it('calls customize with the tabId, prompt, and current code', async () => {
    mockCustomize.mockResolvedValue(successResult('Updated layout'))
    const { result } = await renderFlow(STUB_COMPILED_CODE)
    await act(async () => {
      await result.current.handleCustomizationMessage('Change layout')
    })
    await waitFor(() => {
      expect(mockCustomize).toHaveBeenCalled()
    })
    const [tabId, prompt, code] = mockCustomize.mock.calls[0] as [string, string, string]
    expect(tabId).toBe('tab-1')
    expect(prompt).toBe('Change layout')
    expect(typeof code).toBe('string')
  })

  it('adds an assistant confirmation message on success', async () => {
    mockCustomize.mockResolvedValue(successResult('Added a search bar to the Users table'))
    const { result } = await renderFlow()
    await act(async () => {
      await result.current.handleCustomizationMessage('Add search')
    })
    await waitFor(() => {
      const msg = useTabStore
        .getState()
        .tab.chatHistory.find(
          (m) => m.role === 'assistant' && m.content.includes('Added a search bar'),
        )
      expect(msg).toBeDefined()
    })
  })

  it('marks the customization request as completed in the store', async () => {
    mockCustomize.mockResolvedValue(successResult())
    const { result } = await renderFlow()
    await act(async () => {
      await result.current.handleCustomizationMessage('Update style')
    })
    await waitFor(() => {
      const done = useTabStore
        .getState()
        .tab.customizationQueue.find((r) => r.status === 'completed')
      expect(done).toBeDefined()
    })
  })
})

// ─── Clarification flow ────────────────────────────────────────────────────

describe('useCustomizationFlow — clarification flow', () => {
  it('sets pendingClarification when CLI returns clarificationNeeded:true', async () => {
    mockCustomize.mockResolvedValue({
      success: true,
      clarificationNeeded: true,
      question: 'Which table?',
      options: ['Users', 'Orders'],
      requestId: 'req-1',
    })
    const { result } = await renderFlow()
    await act(async () => {
      await result.current.handleCustomizationMessage('Add search bar')
    })
    await waitFor(() => {
      expect(result.current.pendingClarification?.question).toBe('Which table?')
      expect(result.current.pendingClarification?.options).toEqual(['Users', 'Orders'])
    })
  })

  it('clears pendingClarification and re-sends with choice on onSelect', async () => {
    mockCustomize
      .mockResolvedValueOnce({
        success: true,
        clarificationNeeded: true,
        question: 'Which table?',
        options: ['Users', 'Orders'],
        requestId: 'req-1',
      })
      .mockResolvedValueOnce(successResult('Added to Users table'))

    const { result } = await renderFlow()
    await act(async () => {
      await result.current.handleCustomizationMessage('Add search bar')
    })
    await waitFor(() => {
      expect(result.current.pendingClarification).not.toBeNull()
    })

    const clarif = result.current.pendingClarification
    await act(async () => {
      clarif?.onSelect('Users')
    })

    await waitFor(() => {
      expect(result.current.pendingClarification).toBeNull()
      expect(mockCustomize).toHaveBeenCalledTimes(2)
    })
    expect(mockCustomize.mock.calls[1][1] as string).toContain('Users')
  })
})

// ─── Failure handling ──────────────────────────────────────────────────────

describe('useCustomizationFlow — failure handling', () => {
  it('marks request as failed with errorMessage on CLI error', async () => {
    mockCustomize.mockResolvedValue({ success: false, error: 'CLI timed out', requestId: 'req-1' })
    const { result } = await renderFlow()
    await act(async () => {
      await result.current.handleCustomizationMessage('Update layout')
    })
    await waitFor(() => {
      const failed = useTabStore
        .getState()
        .tab.customizationQueue.find((r) => r.status === 'failed')
      expect(failed?.errorMessage).toMatch(/CLI timed out/i)
    })
  })

  it('adds an error assistant message on failure', async () => {
    mockCustomize.mockResolvedValue({
      success: false,
      error: 'something went wrong',
      requestId: 'req-1',
    })
    const { result } = await renderFlow()
    await act(async () => {
      await result.current.handleCustomizationMessage('Break something')
    })
    await waitFor(() => {
      const msg = useTabStore
        .getState()
        .tab.chatHistory.find(
          (m) => m.role === 'assistant' && m.content.includes('something went wrong'),
        )
      expect(msg).toBeDefined()
    })
  })

  it('shows error message for conflict (remove non-existent element)', async () => {
    mockCustomize.mockResolvedValue({
      success: false,
      error: "Cannot remove 'searchBar' — it does not exist in the interface",
      requestId: 'req-1',
    })
    const { result } = await renderFlow()
    await act(async () => {
      await result.current.handleCustomizationMessage('Remove search bar')
    })
    await waitFor(() => {
      const msg = useTabStore
        .getState()
        .tab.chatHistory.find((m) => m.content.includes('does not exist'))
      expect(msg).toBeDefined()
    })
  })
})
