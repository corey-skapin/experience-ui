// src/renderer/stores/tab-store.test.ts
// T077 — Unit tests for multi-tab store.
// Tests: createTab, closeTab, switchTab, renameTab, reorderTab, per-tab isolation, console entries.

import { beforeEach, describe, expect, it } from 'vitest';

import type { APISpec, ConsoleEntry, ConsoleRequest, ConsoleResponse } from '../../shared/types';
import { useTabStore } from './tab-store';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeSpec(title = 'Test API'): APISpec {
  return {
    id: crypto.randomUUID(),
    format: 'openapi3',
    source: { type: 'text' },
    rawContent: '{}',
    normalizedSpec: {
      format: 'openapi3',
      metadata: { title, version: '1.0.0' },
      models: [],
    },
    validationStatus: 'valid',
    metadata: { title, version: '1.0.0' },
    parsedAt: new Date().toISOString(),
  };
}

function makeConsoleEntry(tabId: string): ConsoleEntry {
  const req: ConsoleRequest = {
    method: 'GET',
    url: 'https://api.example.com/users',
    headers: {},
  };
  const res: ConsoleResponse = {
    statusCode: 200,
    statusText: 'OK',
    headers: {},
    body: '{"ok":true}',
    bodySize: 11,
  };
  return {
    id: crypto.randomUUID(),
    tabId,
    timestamp: new Date().toISOString(),
    request: req,
    response: res,
    elapsedMs: 42,
    status: 'completed',
  };
}

// ─── Setup ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  useTabStore.setState({ tabs: [], activeTabId: null, tabStatuses: {}, consoleEntries: {} });
});

// ─── createTab ───────────────────────────────────────────────────────────────

describe('createTab', () => {
  it('adds a tab to the tabs array', () => {
    useTabStore.getState().createTab();
    expect(useTabStore.getState().tabs).toHaveLength(1);
  });

  it('returns the newly created tab', () => {
    const tab = useTabStore.getState().createTab();
    expect(tab.id).toBeTruthy();
    expect(tab.title).toBe('New Tab');
  });

  it('sets activeTabId to the new tab id', () => {
    const tab = useTabStore.getState().createTab();
    expect(useTabStore.getState().activeTabId).toBe(tab.id);
  });

  it('increments displayOrder for each new tab', () => {
    const t1 = useTabStore.getState().createTab();
    const t2 = useTabStore.getState().createTab();
    expect(t2.displayOrder).toBeGreaterThan(t1.displayOrder);
  });

  it('creates tab with empty chatHistory and customizationQueue', () => {
    const tab = useTabStore.getState().createTab();
    expect(tab.chatHistory).toEqual([]);
    expect(tab.customizationQueue).toEqual([]);
    expect(tab.apiSpec).toBeNull();
  });
});

// ─── closeTab ────────────────────────────────────────────────────────────────

describe('closeTab', () => {
  it('removes the tab from tabs array', () => {
    const t1 = useTabStore.getState().createTab();
    useTabStore.getState().closeTab(t1.id);
    expect(useTabStore.getState().tabs).toHaveLength(0);
  });

  it('returns { removed: true } after removal', () => {
    const t1 = useTabStore.getState().createTab();
    const result = useTabStore.getState().closeTab(t1.id);
    expect(result.removed).toBe(true);
  });

  it('returns requiresConfirmation: true when tab has apiSpec', () => {
    const t1 = useTabStore.getState().createTab();
    useTabStore.getState().loadSpec(t1.id, makeSpec());
    const result = useTabStore.getState().closeTab(t1.id);
    expect(result.requiresConfirmation).toBe(true);
    // Tab is NOT removed when confirmation required
    expect(useTabStore.getState().tabs).toHaveLength(1);
  });

  it('switches to adjacent tab when active tab is closed', () => {
    const t1 = useTabStore.getState().createTab();
    const t2 = useTabStore.getState().createTab();
    useTabStore.getState().switchTab(t1.id);
    useTabStore.getState().closeTab(t1.id);
    expect(useTabStore.getState().activeTabId).toBe(t2.id);
  });

  it('sets activeTabId to null when last tab is closed', () => {
    const t1 = useTabStore.getState().createTab();
    useTabStore.getState().closeTab(t1.id);
    expect(useTabStore.getState().activeTabId).toBeNull();
  });

  it('returns newActiveTabId in result when switching', () => {
    const t1 = useTabStore.getState().createTab();
    const t2 = useTabStore.getState().createTab();
    useTabStore.getState().switchTab(t1.id);
    const result = useTabStore.getState().closeTab(t1.id);
    expect(result.newActiveTabId).toBe(t2.id);
  });
});

// ─── closeTabForced ──────────────────────────────────────────────────────────

describe('closeTabForced', () => {
  it('removes tab even when it has apiSpec (bypasses confirmation)', () => {
    const t1 = useTabStore.getState().createTab();
    useTabStore.getState().loadSpec(t1.id, makeSpec());
    useTabStore.getState().closeTabForced(t1.id);
    expect(useTabStore.getState().tabs).toHaveLength(0);
  });
});

// ─── switchTab ───────────────────────────────────────────────────────────────

describe('switchTab', () => {
  it('sets activeTabId to the given tab id', () => {
    const t1 = useTabStore.getState().createTab();
    const t2 = useTabStore.getState().createTab();
    useTabStore.getState().switchTab(t1.id);
    expect(useTabStore.getState().activeTabId).toBe(t1.id);
    useTabStore.getState().switchTab(t2.id);
    expect(useTabStore.getState().activeTabId).toBe(t2.id);
  });
});

// ─── renameTab ───────────────────────────────────────────────────────────────

describe('renameTab', () => {
  it('updates the tab title', () => {
    const t1 = useTabStore.getState().createTab();
    useTabStore.getState().renameTab(t1.id, 'My API');
    const updated = useTabStore.getState().tabs.find((t) => t.id === t1.id);
    expect(updated?.title).toBe('My API');
  });
});

// ─── reorderTab ──────────────────────────────────────────────────────────────

describe('reorderTab', () => {
  it('updates displayOrder of the target tab', () => {
    const t1 = useTabStore.getState().createTab();
    useTabStore.getState().reorderTab(t1.id, 5);
    const updated = useTabStore.getState().tabs.find((t) => t.id === t1.id);
    expect(updated?.displayOrder).toBe(5);
  });
});

// ─── getActiveTab ────────────────────────────────────────────────────────────

describe('getActiveTab', () => {
  it('returns undefined when no tabs exist', () => {
    expect(useTabStore.getState().getActiveTab()).toBeUndefined();
  });

  it('returns the active tab', () => {
    const t1 = useTabStore.getState().createTab();
    useTabStore.getState().createTab();
    useTabStore.getState().switchTab(t1.id);
    expect(useTabStore.getState().getActiveTab()?.id).toBe(t1.id);
  });
});

// ─── Per-tab state isolation ─────────────────────────────────────────────────

describe('per-tab isolation', () => {
  it('loadSpec updates only the target tab', () => {
    const t1 = useTabStore.getState().createTab();
    const t2 = useTabStore.getState().createTab();
    useTabStore.getState().loadSpec(t1.id, makeSpec('API-1'));
    expect(useTabStore.getState().tabs.find((t) => t.id === t1.id)?.apiSpec?.metadata.title).toBe(
      'API-1',
    );
    expect(useTabStore.getState().tabs.find((t) => t.id === t2.id)?.apiSpec).toBeNull();
  });

  it('addChatMessage updates only the target tab chatHistory', () => {
    const t1 = useTabStore.getState().createTab();
    const t2 = useTabStore.getState().createTab();
    useTabStore.getState().addChatMessage(t1.id, {
      id: 'msg1',
      tabId: t1.id,
      role: 'user',
      content: 'hello',
      timestamp: new Date().toISOString(),
      status: 'sent',
      relatedVersionId: null,
    });
    expect(useTabStore.getState().tabs.find((t) => t.id === t1.id)?.chatHistory).toHaveLength(1);
    expect(useTabStore.getState().tabs.find((t) => t.id === t2.id)?.chatHistory).toHaveLength(0);
  });

  it('consoleEntries are independent per tab', () => {
    const t1 = useTabStore.getState().createTab();
    const t2 = useTabStore.getState().createTab();
    useTabStore.getState().addConsoleEntry(t1.id, makeConsoleEntry(t1.id));
    expect(useTabStore.getState().consoleEntries[t1.id]).toHaveLength(1);
    expect(useTabStore.getState().consoleEntries[t2.id] ?? []).toHaveLength(0);
  });

  it('clearConsoleEntries clears only the target tab', () => {
    const t1 = useTabStore.getState().createTab();
    const t2 = useTabStore.getState().createTab();
    useTabStore.getState().addConsoleEntry(t1.id, makeConsoleEntry(t1.id));
    useTabStore.getState().addConsoleEntry(t2.id, makeConsoleEntry(t2.id));
    useTabStore.getState().clearConsoleEntries(t1.id);
    expect(useTabStore.getState().consoleEntries[t1.id] ?? []).toHaveLength(0);
    expect(useTabStore.getState().consoleEntries[t2.id]).toHaveLength(1);
  });
});

// ─── tabStatus ───────────────────────────────────────────────────────────────

describe('tabStatus', () => {
  it('starts as "empty"', () => {
    const t1 = useTabStore.getState().createTab();
    expect(useTabStore.getState().tabStatuses[t1.id]).toBe('empty');
  });

  it('becomes "spec-loaded" after loadSpec', () => {
    const t1 = useTabStore.getState().createTab();
    useTabStore.getState().loadSpec(t1.id, makeSpec());
    expect(useTabStore.getState().tabStatuses[t1.id]).toBe('spec-loaded');
  });

  it('becomes "generating" after startGenerating', () => {
    const t1 = useTabStore.getState().createTab();
    useTabStore.getState().loadSpec(t1.id, makeSpec());
    useTabStore.getState().startGenerating(t1.id);
    expect(useTabStore.getState().tabStatuses[t1.id]).toBe('generating');
  });

  it('becomes "interface-ready" after finishGenerating', () => {
    const t1 = useTabStore.getState().createTab();
    useTabStore.getState().loadSpec(t1.id, makeSpec());
    useTabStore.getState().startGenerating(t1.id);
    useTabStore.getState().finishGenerating(t1.id);
    expect(useTabStore.getState().tabStatuses[t1.id]).toBe('interface-ready');
  });

  it('resets to "empty" after clearSpec', () => {
    const t1 = useTabStore.getState().createTab();
    useTabStore.getState().loadSpec(t1.id, makeSpec());
    useTabStore.getState().clearSpec(t1.id);
    expect(useTabStore.getState().tabStatuses[t1.id]).toBe('empty');
  });
});
