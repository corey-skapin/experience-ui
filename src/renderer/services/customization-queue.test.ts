// src/renderer/services/customization-queue.test.ts
// T057 — Unit tests for CustomizationQueue service.
// Tests FIFO ordering, sequential processing, status transitions, and queue depth limits.

import { beforeEach, describe, expect, it } from 'vitest';

import { CustomizationQueue } from './customization-queue';

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('CustomizationQueue', () => {
  let queue: CustomizationQueue;

  beforeEach(() => {
    queue = new CustomizationQueue();
  });

  // ── enqueue ──────────────────────────────────────────────────────────────

  describe('enqueue', () => {
    it('returns a non-empty string id', () => {
      const id = queue.enqueue('tab-1', 'Add a search bar', 'const x = 1;');
      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(0);
    });

    it('enqueued request starts with status "queued"', () => {
      const id = queue.enqueue('tab-1', 'Add a search bar', 'const x = 1;');
      const items = queue.getQueue('tab-1');
      expect(items).toHaveLength(1);
      expect(items[0].id).toBe(id);
      expect(items[0].status).toBe('queued');
    });

    it('stores prompt and currentCode on the request', () => {
      const id = queue.enqueue('tab-1', 'my prompt', 'my code');
      const item = queue.getQueue('tab-1').find((r) => r.id === id)!;
      expect(item.prompt).toBe('my prompt');
      expect(item.currentCode).toBe('my code');
      expect(item.tabId).toBe('tab-1');
    });

    it('throws when more than 10 active requests exist for a tab', () => {
      for (let i = 0; i < 10; i++) {
        queue.enqueue('tab-1', `request ${i}`, 'code');
      }
      expect(() => queue.enqueue('tab-1', 'overflow', 'code')).toThrow();
    });

    it('completed and failed requests do not count toward the depth limit', () => {
      const id1 = queue.enqueue('tab-1', 'r1', 'code');
      const id2 = queue.enqueue('tab-1', 'r2', 'code');
      queue.markInProgress(id1);
      queue.complete(id1, 'result-code');
      queue.fail(id2, 'error');

      // Active count is now 0 — should allow 10 more
      for (let i = 0; i < 10; i++) {
        queue.enqueue('tab-1', `r${i + 3}`, 'code');
      }
      const active = queue
        .getQueue('tab-1')
        .filter((r) => r.status === 'queued' || r.status === 'in-progress');
      expect(active).toHaveLength(10);
    });

    it('limits are per-tab: a full tab-1 does not block tab-2', () => {
      for (let i = 0; i < 10; i++) {
        queue.enqueue('tab-1', `r${i}`, 'code');
      }
      expect(() => queue.enqueue('tab-2', 'ok', 'code')).not.toThrow();
    });
  });

  // ── getQueue ─────────────────────────────────────────────────────────────

  describe('getQueue', () => {
    it('returns empty array for an unknown tab', () => {
      expect(queue.getQueue('unknown')).toEqual([]);
    });

    it('returns all requests for a tab including completed ones', () => {
      const id1 = queue.enqueue('tab-1', 'r1', 'code');
      const id2 = queue.enqueue('tab-1', 'r2', 'code');
      queue.markInProgress(id1);
      queue.complete(id1, 'done');
      expect(queue.getQueue('tab-1')).toHaveLength(2);
      expect(queue.getQueue('tab-1').map((r) => r.id)).toEqual([id1, id2]);
    });
  });

  // ── FIFO ordering ─────────────────────────────────────────────────────────

  describe('FIFO ordering via getNext', () => {
    it('getNext returns requests in enqueue order', () => {
      const id1 = queue.enqueue('tab-1', 'first', 'code');
      const id2 = queue.enqueue('tab-1', 'second', 'code');
      const id3 = queue.enqueue('tab-1', 'third', 'code');

      expect(queue.getNext('tab-1')?.id).toBe(id1);
      queue.markInProgress(id1);
      queue.complete(id1, 'result');

      expect(queue.getNext('tab-1')?.id).toBe(id2);
      queue.markInProgress(id2);
      queue.complete(id2, 'result');

      expect(queue.getNext('tab-1')?.id).toBe(id3);
    });
  });

  // ── Sequential processing ──────────────────────────────────────────────────

  describe('sequential processing — only one in-progress at a time', () => {
    it('getNext returns undefined while a request is in-progress', () => {
      const id1 = queue.enqueue('tab-1', 'first', 'code');
      queue.enqueue('tab-1', 'second', 'code');
      queue.markInProgress(id1);
      expect(queue.getNext('tab-1')).toBeUndefined();
    });

    it('hasInProgress returns true when a request is in-progress', () => {
      const id = queue.enqueue('tab-1', 'r1', 'code');
      queue.markInProgress(id);
      expect(queue.hasInProgress('tab-1')).toBe(true);
    });

    it('hasInProgress returns false when no in-progress request exists', () => {
      queue.enqueue('tab-1', 'r1', 'code');
      expect(queue.hasInProgress('tab-1')).toBe(false);
    });

    it('hasInProgress returns false after completion', () => {
      const id = queue.enqueue('tab-1', 'r1', 'code');
      queue.markInProgress(id);
      queue.complete(id, 'result');
      expect(queue.hasInProgress('tab-1')).toBe(false);
    });
  });

  // ── Status transitions ────────────────────────────────────────────────────

  describe('status transitions', () => {
    it('follows queued → in-progress → completed', () => {
      const id = queue.enqueue('tab-1', 'r1', 'code');
      expect(queue.getQueue('tab-1')[0].status).toBe('queued');

      queue.markInProgress(id);
      expect(queue.getQueue('tab-1')[0].status).toBe('in-progress');

      queue.complete(id, 'new-code');
      const item = queue.getQueue('tab-1')[0];
      expect(item.status).toBe('completed');
      expect(item.resultCode).toBe('new-code');
      expect(item.completedAt).toBeDefined();
    });

    it('follows queued → in-progress → failed', () => {
      const id = queue.enqueue('tab-1', 'r1', 'code');
      queue.markInProgress(id);
      queue.fail(id, 'something went wrong');

      const item = queue.getQueue('tab-1')[0];
      expect(item.status).toBe('failed');
      expect(item.error).toBe('something went wrong');
      expect(item.completedAt).toBeDefined();
    });
  });

  // ── Failed requests do not block subsequent ───────────────────────────────

  describe('failed requests do not block the queue', () => {
    it('getNext returns next queued item after a failure', () => {
      const id1 = queue.enqueue('tab-1', 'first', 'code');
      const id2 = queue.enqueue('tab-1', 'second', 'code');
      queue.markInProgress(id1);
      queue.fail(id1, 'error');

      expect(queue.getNext('tab-1')?.id).toBe(id2);
    });
  });

  // ── clear ─────────────────────────────────────────────────────────────────

  describe('clear', () => {
    it('removes all requests for a tab', () => {
      queue.enqueue('tab-1', 'r1', 'code');
      queue.enqueue('tab-1', 'r2', 'code');
      queue.clear('tab-1');
      expect(queue.getQueue('tab-1')).toEqual([]);
    });

    it('does not affect other tabs', () => {
      queue.enqueue('tab-1', 'r1', 'code');
      queue.enqueue('tab-2', 'r2', 'code');
      queue.clear('tab-1');
      expect(queue.getQueue('tab-2')).toHaveLength(1);
    });
  });
});
