// src/renderer/services/customization-queue.ts
// T058 — FIFO customization request queue per tab.
// Enforces sequential processing (one in-progress at a time) and a depth limit of 10.

// ─── Types ────────────────────────────────────────────────────────────────────

export type CustomizationStatus = 'queued' | 'in-progress' | 'completed' | 'failed';

export interface QueuedCustomization {
  id: string;
  tabId: string;
  prompt: string;
  currentCode: string;
  status: CustomizationStatus;
  createdAt: number;
  completedAt?: number;
  resultCode?: string;
  error?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_ACTIVE_DEPTH = 10;

// ─── Class ────────────────────────────────────────────────────────────────────

export class CustomizationQueue {
  private readonly queues = new Map<string, QueuedCustomization[]>();

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Enqueue a new customization request.
   * Throws if the active depth (queued + in-progress) for the tab exceeds MAX_ACTIVE_DEPTH.
   */
  enqueue(tabId: string, prompt: string, currentCode: string): string {
    const entries = this.getOrCreate(tabId);
    const activeCount = entries.filter(
      (r) => r.status === 'queued' || r.status === 'in-progress',
    ).length;

    if (activeCount >= MAX_ACTIVE_DEPTH) {
      throw new Error(
        `Customization queue depth limit (${MAX_ACTIVE_DEPTH}) reached for tab ${tabId}`,
      );
    }

    const request: QueuedCustomization = {
      id: crypto.randomUUID(),
      tabId,
      prompt,
      currentCode,
      status: 'queued',
      createdAt: Date.now(),
    };

    entries.push(request);
    return request.id;
  }

  /** Return all requests for a tab (all statuses, insertion order). */
  getQueue(tabId: string): QueuedCustomization[] {
    return this.queues.get(tabId) ?? [];
  }

  /**
   * Return the next queued request to process, or undefined if:
   * - There is an in-progress request (sequential constraint), or
   * - There are no queued requests.
   */
  getNext(tabId: string): QueuedCustomization | undefined {
    if (this.hasInProgress(tabId)) return undefined;
    return (this.queues.get(tabId) ?? []).find((r) => r.status === 'queued');
  }

  /** Whether any request is currently in-progress for the tab. */
  hasInProgress(tabId: string): boolean {
    return (this.queues.get(tabId) ?? []).some((r) => r.status === 'in-progress');
  }

  /** Transition a request from 'queued' → 'in-progress'. */
  markInProgress(requestId: string): void {
    this.mutate(requestId, (r) => ({ ...r, status: 'in-progress' }));
  }

  /** Transition a request to 'completed' and store the result code. */
  complete(requestId: string, resultCode: string): void {
    this.mutate(requestId, (r) => ({
      ...r,
      status: 'completed',
      resultCode,
      completedAt: Date.now(),
    }));
  }

  /** Transition a request to 'failed' and store the error message. */
  fail(requestId: string, error: string): void {
    this.mutate(requestId, (r) => ({
      ...r,
      status: 'failed',
      error,
      completedAt: Date.now(),
    }));
  }

  /** Remove all requests for a tab. */
  clear(tabId: string): void {
    this.queues.delete(tabId);
  }

  // ── Internals ──────────────────────────────────────────────────────────────

  private getOrCreate(tabId: string): QueuedCustomization[] {
    if (!this.queues.has(tabId)) this.queues.set(tabId, []);
    // Map.get is always defined here since we just set it above
    return this.queues.get(tabId) ?? [];
  }

  private mutate(
    requestId: string,
    updater: (r: QueuedCustomization) => QueuedCustomization,
  ): void {
    for (const [tabId, entries] of this.queues) {
      const idx = entries.findIndex((r) => r.id === requestId);
      if (idx !== -1) {
        entries[idx] = updater(entries[idx]);
        this.queues.set(tabId, [...entries]);
        return;
      }
    }
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

export const customizationQueue = new CustomizationQueue();
