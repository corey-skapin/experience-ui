/**
 * Unit tests for the customization request queue service.
 * Tests: FIFO ordering, sequential processing, failed-request recovery,
 * status transitions, and queue depth limits.
 *
 * Written FIRST (TDD) — must fail before the implementation exists.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { CustomizationRequest } from '../../shared/types'
import type { CustomizationQueueResult, CustomizationQueueService } from './customization-queue'

// ─── Helpers ──────────────────────────────────────────────────────────────

function makeRequest(tabId: string, id: string): CustomizationRequest {
  return {
    id,
    tabId,
    prompt: `prompt-${id}`,
    status: 'queued',
    chatMessageId: `msg-${id}`,
    resultVersionId: null,
    errorMessage: null,
    queuedAt: Date.now(),
    startedAt: null,
    completedAt: null,
  }
}

function deferred<T = CustomizationQueueResult>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

// ─── Setup ────────────────────────────────────────────────────────────────

// Delay the import so tests can import after setup
let customizationQueue: CustomizationQueueService

beforeEach(async () => {
  vi.useFakeTimers()
  const mod = await import('./customization-queue')
  customizationQueue = mod.customizationQueue
  customizationQueue.clear()
})

afterEach(() => {
  vi.useRealTimers()
})

// ─── FIFO ordering ────────────────────────────────────────────────────────

describe('FIFO ordering', () => {
  it('processes requests in the order they were enqueued', async () => {
    const order: string[] = []
    const processor = (req: CustomizationRequest) => {
      order.push(req.id)
      return Promise.resolve({ success: true })
    }

    await Promise.all([
      customizationQueue.enqueue(makeRequest('tab-1', 'req-A'), processor),
      customizationQueue.enqueue(makeRequest('tab-1', 'req-B'), processor),
      customizationQueue.enqueue(makeRequest('tab-1', 'req-C'), processor),
    ])

    expect(order).toEqual(['req-A', 'req-B', 'req-C'])
  })

  it('maintains independent FIFO queues per tab', async () => {
    const order: string[] = []
    const processor = (req: CustomizationRequest) => {
      order.push(req.id)
      return Promise.resolve({ success: true })
    }

    await Promise.all([
      customizationQueue.enqueue(makeRequest('tab-1', 't1-A'), processor),
      customizationQueue.enqueue(makeRequest('tab-2', 't2-A'), processor),
      customizationQueue.enqueue(makeRequest('tab-1', 't1-B'), processor),
    ])

    // tab-1 requests must be processed in order among themselves
    const tab1Order = order.filter((id) => id.startsWith('t1-'))
    expect(tab1Order).toEqual(['t1-A', 't1-B'])
  })
})

// ─── Sequential processing ────────────────────────────────────────────────

describe('sequential processing', () => {
  it('processes only one request at a time per tab', async () => {
    const d1 = deferred()
    const processor1 = vi.fn().mockReturnValue(d1.promise)
    const processor2 = vi.fn().mockResolvedValue({ success: true })

    const p1 = customizationQueue.enqueue(makeRequest('tab-1', 'req-1'), processor1)
    const p2 = customizationQueue.enqueue(makeRequest('tab-1', 'req-2'), processor2)

    // Flush microtasks: processor1 should start, processor2 should still be queued
    await Promise.resolve()

    expect(processor1).toHaveBeenCalledTimes(1)
    expect(processor2).toHaveBeenCalledTimes(0)
    expect(customizationQueue.getStatus('req-2')).toBe('queued')

    // Unblock req-1
    d1.resolve({ success: true })
    await p1

    // Allow processNext() microtask to run
    await Promise.resolve()

    expect(processor2).toHaveBeenCalledTimes(1)
    await p2
  })

  it('does not block requests in different tabs', async () => {
    const d1 = deferred()
    const processor1 = vi.fn().mockReturnValue(d1.promise)
    const processor2 = vi.fn().mockResolvedValue({ success: true })

    customizationQueue.enqueue(makeRequest('tab-1', 'req-1'), processor1)
    const p2 = customizationQueue.enqueue(makeRequest('tab-2', 'req-2'), processor2)

    // tab-2 should process independently of tab-1
    await p2

    expect(processor2).toHaveBeenCalledTimes(1)

    // Clean up deferred
    d1.resolve({ success: true })
  })

  it('reports in-progress status while processor is running', async () => {
    const d = deferred()
    const processor = vi.fn().mockReturnValue(d.promise)

    const promise = customizationQueue.enqueue(makeRequest('tab-1', 'req-1'), processor)

    // Flush to let processNext start
    await Promise.resolve()

    expect(customizationQueue.getStatus('req-1')).toBe('in-progress')

    d.resolve({ success: true })
    await promise
  })
})

// ─── Failed request recovery ──────────────────────────────────────────────

describe('failed request recovery', () => {
  it('failed request does not block the next request in queue', async () => {
    const processor1 = vi.fn().mockRejectedValue(new Error('network error'))
    const processor2 = vi.fn().mockResolvedValue({ success: true })

    const p1 = customizationQueue.enqueue(makeRequest('tab-1', 'req-1'), processor1)
    const p2 = customizationQueue.enqueue(makeRequest('tab-1', 'req-2'), processor2)

    await p1 // should resolve (not throw), with success: false
    await p2

    expect(customizationQueue.getStatus('req-1')).toBe('failed')
    expect(customizationQueue.getStatus('req-2')).toBe('completed')
  })

  it('surfaces the error message on failure', async () => {
    const processor = vi.fn().mockRejectedValue(new Error('CLI timed out'))

    const result = await customizationQueue.enqueue(makeRequest('tab-1', 'req-1'), processor)

    expect(result.success).toBe(false)
    expect(result.error).toMatch(/CLI timed out/i)
  })

  it('enqueue never throws — failed processor resolves to { success: false }', async () => {
    const processor = vi.fn().mockRejectedValue(new Error('boom'))

    const result = await customizationQueue.enqueue(makeRequest('tab-1', 'req-1'), processor)

    expect(result.success).toBe(false)
  })
})

// ─── Status transitions ───────────────────────────────────────────────────

describe('status transitions', () => {
  it('transitions: queued → in-progress → completed', async () => {
    const d = deferred()
    const processor = vi.fn().mockReturnValue(d.promise)

    const promise = customizationQueue.enqueue(makeRequest('tab-1', 'req-1'), processor)

    // Initial state
    expect(customizationQueue.getStatus('req-1')).toBe('queued')

    // After first microtask flush, processor starts
    await Promise.resolve()
    expect(customizationQueue.getStatus('req-1')).toBe('in-progress')

    // After resolution
    d.resolve({ success: true })
    await promise
    expect(customizationQueue.getStatus('req-1')).toBe('completed')
  })

  it('transitions: queued → in-progress → failed on rejected processor', async () => {
    const processor = vi.fn().mockRejectedValue(new Error('fail'))

    const promise = customizationQueue.enqueue(makeRequest('tab-1', 'req-1'), processor)

    await Promise.resolve()
    expect(customizationQueue.getStatus('req-1')).toBe('in-progress')

    await promise
    expect(customizationQueue.getStatus('req-1')).toBe('failed')
  })

  it('returns undefined for unknown request ids', () => {
    expect(customizationQueue.getStatus('non-existent')).toBeUndefined()
  })
})

// ─── Queue depth limits ───────────────────────────────────────────────────

describe('queue depth limits', () => {
  it('limits active (queued + in-progress) requests to 10 per tab', async () => {
    const d = deferred()
    // req-1 stays in-progress
    customizationQueue.enqueue(makeRequest('tab-1', 'req-1'), () => d.promise)

    await Promise.resolve() // let req-1 start

    // Fill the remaining 9 active slots
    for (let i = 2; i <= 10; i++) {
      customizationQueue.enqueue(makeRequest('tab-1', `req-${i}`), () =>
        Promise.resolve({ success: true }),
      )
    }

    expect(customizationQueue.getActiveCount('tab-1')).toBe(10)

    // 11th request should be rejected immediately
    const overflow = await customizationQueue.enqueue(makeRequest('tab-1', 'req-overflow'), () =>
      Promise.resolve({ success: true }),
    )

    expect(overflow.success).toBe(false)
    expect(overflow.error).toMatch(/full/i)

    // Clean up
    d.resolve({ success: true })
  })

  it('completed and failed items do not count toward the active limit', async () => {
    // Complete 10 requests
    const processors = Array.from({ length: 10 }, () =>
      vi.fn().mockResolvedValue({ success: true }),
    )
    await Promise.all(
      processors.map((p, i) => customizationQueue.enqueue(makeRequest('tab-1', `done-${i}`), p)),
    )

    // All done — active count must be 0
    expect(customizationQueue.getActiveCount('tab-1')).toBe(0)

    // Can still enqueue new requests up to the limit
    const result = await customizationQueue.enqueue(makeRequest('tab-1', 'after-complete'), () =>
      Promise.resolve({ success: true }),
    )
    expect(result.success).toBe(true)
  })

  it('counts in-progress item separately from queued items', async () => {
    const d = deferred()
    customizationQueue.enqueue(makeRequest('tab-1', 'req-1'), () => d.promise)

    await Promise.resolve() // req-1 moves to in-progress, queue is empty

    expect(customizationQueue.getActiveCount('tab-1')).toBe(1)

    customizationQueue.enqueue(makeRequest('tab-1', 'req-2'), () =>
      Promise.resolve({ success: true }),
    )

    expect(customizationQueue.getActiveCount('tab-1')).toBe(2)

    d.resolve({ success: true })
  })
})
