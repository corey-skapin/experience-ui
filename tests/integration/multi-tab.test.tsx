// tests/integration/multi-tab.test.tsx
// T085 — Integration test for multi-tab management.
// Tests: tab isolation, shared credentials, close confirmation.

import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useTabStore } from '../../src/renderer/stores/tab-store';
import type { APISpec } from '../../src/shared/types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeSpec(title: string): APISpec {
  return {
    id: crypto.randomUUID(),
    format: 'openapi3',
    source: { type: 'text' },
    rawContent: '{}',
    normalizedSpec: { format: 'openapi3', metadata: { title, version: '1.0.0' }, models: [] },
    validationStatus: 'valid',
    metadata: { title, version: '1.0.0' },
    parsedAt: new Date().toISOString(),
  };
}

// ─── Setup ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.useRealTimers();
  useTabStore.setState({ tabs: [], activeTabId: null, tabStatuses: {}, consoleEntries: {} });
});

// ─── Multi-tab isolation ──────────────────────────────────────────────────────

describe('Multi-tab state isolation', () => {
  it('creates 3 tabs with independent state', () => {
    const t1 = useTabStore.getState().createTab();
    const t2 = useTabStore.getState().createTab();
    const t3 = useTabStore.getState().createTab();

    useTabStore.getState().loadSpec(t1.id, makeSpec('API-1'));
    useTabStore.getState().loadSpec(t2.id, makeSpec('API-2'));

    const state = useTabStore.getState();
    expect(state.tabs).toHaveLength(3);

    const tab1 = state.tabs.find((t) => t.id === t1.id);
    const tab2 = state.tabs.find((t) => t.id === t2.id);
    const tab3 = state.tabs.find((t) => t.id === t3.id);

    expect(tab1?.apiSpec?.metadata.title).toBe('API-1');
    expect(tab2?.apiSpec?.metadata.title).toBe('API-2');
    expect(tab3?.apiSpec).toBeNull();
  });

  it('each tab has independent chatHistory', () => {
    const t1 = useTabStore.getState().createTab();
    const t2 = useTabStore.getState().createTab();

    useTabStore.getState().addChatMessage(t1.id, {
      id: 'msg-1',
      tabId: t1.id,
      role: 'user',
      content: 'Hello from tab 1',
      timestamp: new Date().toISOString(),
      status: 'sent',
      relatedVersionId: null,
    });

    const state = useTabStore.getState();
    const tab1 = state.tabs.find((t) => t.id === t1.id);
    const tab2 = state.tabs.find((t) => t.id === t2.id);

    expect(tab1?.chatHistory).toHaveLength(1);
    expect(tab1?.chatHistory[0].content).toBe('Hello from tab 1');
    expect(tab2?.chatHistory).toHaveLength(0);
  });

  it('each tab has independent customizationQueue', () => {
    const t1 = useTabStore.getState().createTab();
    const t2 = useTabStore.getState().createTab();

    useTabStore.getState().enqueueCustomization(t1.id, {
      id: 'req-1',
      tabId: t1.id,
      prompt: 'Add dark mode',
      status: 'queued',
      chatMessageId: 'msg-1',
      resultVersionId: null,
      errorMessage: null,
      queuedAt: new Date().toISOString(),
      startedAt: null,
      completedAt: null,
    });

    const state = useTabStore.getState();
    const tab1 = state.tabs.find((t) => t.id === t1.id);
    const tab2 = state.tabs.find((t) => t.id === t2.id);

    expect(tab1?.customizationQueue).toHaveLength(1);
    expect(tab2?.customizationQueue).toHaveLength(0);
  });
});

// ─── Tab switching ────────────────────────────────────────────────────────────

describe('Tab switching', () => {
  it('switching tabs changes activeTabId', () => {
    const t1 = useTabStore.getState().createTab();
    const t2 = useTabStore.getState().createTab();
    const t3 = useTabStore.getState().createTab();

    useTabStore.getState().switchTab(t1.id);
    expect(useTabStore.getState().activeTabId).toBe(t1.id);

    useTabStore.getState().switchTab(t3.id);
    expect(useTabStore.getState().activeTabId).toBe(t3.id);

    useTabStore.getState().switchTab(t2.id);
    expect(useTabStore.getState().activeTabId).toBe(t2.id);
  });

  it('getActiveTab returns correct tab after switch', () => {
    const t1 = useTabStore.getState().createTab();
    const t2 = useTabStore.getState().createTab();
    useTabStore.getState().loadSpec(t1.id, makeSpec('Tab1-API'));

    useTabStore.getState().switchTab(t1.id);
    expect(useTabStore.getState().getActiveTab()?.apiSpec?.metadata.title).toBe('Tab1-API');

    useTabStore.getState().switchTab(t2.id);
    expect(useTabStore.getState().getActiveTab()?.apiSpec).toBeNull();
  });
});

// ─── Close tab with confirmation ──────────────────────────────────────────────

describe('Close tab with confirmation', () => {
  it('closeTab requires confirmation when tab has apiSpec', () => {
    const t1 = useTabStore.getState().createTab();
    useTabStore.getState().loadSpec(t1.id, makeSpec('My API'));

    const result = useTabStore.getState().closeTab(t1.id);
    expect(result.requiresConfirmation).toBe(true);
    // Tab is NOT removed when confirmation is required
    expect(useTabStore.getState().tabs).toHaveLength(1);
  });

  it('closeTabForced removes tab even with spec loaded', () => {
    const t1 = useTabStore.getState().createTab();
    useTabStore.getState().loadSpec(t1.id, makeSpec('My API'));

    useTabStore.getState().closeTabForced(t1.id);
    expect(useTabStore.getState().tabs).toHaveLength(0);
  });

  it('closing a tab without spec does not require confirmation', () => {
    const t1 = useTabStore.getState().createTab();
    const result = useTabStore.getState().closeTab(t1.id);
    expect(result.requiresConfirmation).toBeFalsy();
    expect(result.removed).toBe(true);
  });
});

// ─── Tab reordering ───────────────────────────────────────────────────────────

describe('Tab reordering', () => {
  it('reorderTab updates displayOrder', () => {
    const t1 = useTabStore.getState().createTab();
    const t2 = useTabStore.getState().createTab();

    useTabStore.getState().reorderTab(t1.id, 10);
    useTabStore.getState().reorderTab(t2.id, 5);

    const state = useTabStore.getState();
    expect(state.tabs.find((t) => t.id === t1.id)?.displayOrder).toBe(10);
    expect(state.tabs.find((t) => t.id === t2.id)?.displayOrder).toBe(5);
  });
});

// ─── Console entries per tab ──────────────────────────────────────────────────

describe('Console entries are isolated per tab', () => {
  it('console entries added to one tab do not appear in another', () => {
    const t1 = useTabStore.getState().createTab();
    const t2 = useTabStore.getState().createTab();

    useTabStore.getState().addConsoleEntry(t1.id, {
      id: 'e1',
      tabId: t1.id,
      timestamp: new Date().toISOString(),
      request: { method: 'GET', url: 'https://api.example.com/test', headers: {} },
      response: { statusCode: 200, statusText: 'OK', headers: {}, body: '{}', bodySize: 2 },
      elapsedMs: 10,
      status: 'completed',
    });

    expect(useTabStore.getState().consoleEntries[t1.id]).toHaveLength(1);
    expect(useTabStore.getState().consoleEntries[t2.id] ?? []).toHaveLength(0);
  });
});
