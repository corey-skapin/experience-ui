/**
 * Customization request queue service.
 * Provides per-tab FIFO queues with sequential processing,
 * status tracking, and a configurable depth limit.
 *
 * Export: singleton `customizationQueue` with `.clear()` for testability.
 */
import type { CustomizationRequest, CustomizationStatus } from '../../shared/types'

// ─── Constants ────────────────────────────────────────────────────────────

const MAX_ACTIVE_PER_TAB = 10

// ─── Types ────────────────────────────────────────────────────────────────

export interface CustomizationQueueResult {
  success: boolean
  code?: string | null
  description?: string
  assumptions?: string[]
  clarificationNeeded?: boolean
  question?: string
  options?: string[]
  error?: string
}

export type CustomizationProcessor = (
  request: CustomizationRequest,
) => Promise<CustomizationQueueResult>

interface QueueItem {
  request: CustomizationRequest
  processor: CustomizationProcessor
  resolve: (result: CustomizationQueueResult) => void
}

// ─── Service ──────────────────────────────────────────────────────────────

export class CustomizationQueueService {
  /** Pending items (not yet started), keyed by tabId. */
  private readonly tabQueues = new Map<string, QueueItem[]>()
  /** Tabs that currently have a processor running. */
  private readonly tabInProgress = new Set<string>()
  /** Status of every known request, keyed by requestId. */
  private readonly requestStatuses = new Map<string, CustomizationStatus>()

  /**
   * Enqueue a customization request for sequential processing.
   * Returns a Promise that resolves with the processor result (never throws).
   * Resolves immediately with an error result if the tab queue is full.
   */
  enqueue(
    request: CustomizationRequest,
    processor: CustomizationProcessor,
  ): Promise<CustomizationQueueResult> {
    if (this.getActiveCount(request.tabId) >= MAX_ACTIVE_PER_TAB) {
      return Promise.resolve({
        success: false,
        error: `Queue is full — max ${MAX_ACTIVE_PER_TAB} active requests per tab`,
      })
    }

    this.requestStatuses.set(request.id, 'queued')

    return new Promise<CustomizationQueueResult>((resolve) => {
      const queue = this.tabQueues.get(request.tabId) ?? []
      queue.push({ request, processor, resolve })
      this.tabQueues.set(request.tabId, queue)
      // Defer so the caller can observe the 'queued' status synchronously
      void Promise.resolve().then(() => this.processNext(request.tabId))
    })
  }

  /** Return the current status of a request, or undefined if unknown. */
  getStatus(requestId: string): CustomizationStatus | undefined {
    return this.requestStatuses.get(requestId)
  }

  /**
   * Return the number of active (queued + in-progress) items for a tab.
   * Completed and failed items are not counted.
   */
  getActiveCount(tabId: string): number {
    const queued = this.tabQueues.get(tabId)?.length ?? 0
    const inProgress = this.tabInProgress.has(tabId) ? 1 : 0
    return queued + inProgress
  }

  /** Reset all internal state — primarily for use in test beforeEach hooks. */
  clear(): void {
    this.tabQueues.clear()
    this.tabInProgress.clear()
    this.requestStatuses.clear()
  }

  // ─── Private ────────────────────────────────────────────────────────────

  private processNext(tabId: string): void {
    if (this.tabInProgress.has(tabId)) return

    const queue = this.tabQueues.get(tabId)
    if (!queue?.length) return

    const item = queue.shift()
    if (!item) return
    this.tabInProgress.add(tabId)
    this.requestStatuses.set(item.request.id, 'in-progress')

    void item.processor(item.request).then(
      (result) => {
        this.requestStatuses.set(item.request.id, 'completed')
        this.tabInProgress.delete(tabId)
        item.resolve(result)
        this.processNext(tabId)
      },
      (err: unknown) => {
        const message = err instanceof Error ? err.message : String(err)
        this.requestStatuses.set(item.request.id, 'failed')
        this.tabInProgress.delete(tabId)
        item.resolve({ success: false, error: message })
        this.processNext(tabId)
      },
    )
  }
}

// ─── Singleton export ─────────────────────────────────────────────────────

export const customizationQueue = new CustomizationQueueService()
