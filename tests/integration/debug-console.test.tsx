// tests/integration/debug-console.test.tsx
// T093 — Integration test for the debug console panel.
// Tests: entry capture, filtering, clear.

import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { useTabStore } from '../../src/renderer/stores/tab-store';
import { useAppStore } from '../../src/renderer/stores/app-store';
import type { ConsoleEntry } from '../../src/shared/types';
import { ConsolePanel } from '../../src/renderer/components/console/ConsolePanel';

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getVirtualItems: () =>
      Array.from({ length: count }, (_, i) => ({ key: i, index: i, start: i * 32, size: 32 })),
    getTotalSize: () => count * 32,
    scrollToIndex: vi.fn(),
  }),
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeEntry(
  method: string,
  url: string,
  statusCode: number,
  tabId = 'tab-1',
): ConsoleEntry {
  return {
    id: crypto.randomUUID(),
    tabId,
    timestamp: new Date().toISOString(),
    request: { method, url, headers: {} },
    response: {
      statusCode,
      statusText: statusCode < 400 ? 'OK' : 'Error',
      headers: {},
      body: '{"ok":true}',
      bodySize: 11,
    },
    elapsedMs: 42,
    status: 'completed',
  };
}

// ─── Setup ───────────────────────────────────────────────────────────────────

const TAB_ID = 'tab-console-test';

beforeEach(() => {
  vi.useRealTimers();
  useTabStore.setState({ tabs: [], activeTabId: null, tabStatuses: {}, consoleEntries: {} });
  useAppStore.setState({ consoleVisible: false });
});

// ─── ConsolePanel visibility ──────────────────────────────────────────────────

describe('ConsolePanel visibility', () => {
  it('renders null when isVisible is false', () => {
    const { container } = render(
      <ConsolePanel
        entries={[]}
        onClear={vi.fn()}
        isVisible={false}
        tabId={TAB_ID}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders the panel when isVisible is true', () => {
    render(
      <ConsolePanel
        entries={[]}
        onClear={vi.fn()}
        isVisible
        tabId={TAB_ID}
      />,
    );
    expect(screen.getByRole('region', { name: /debug console/i })).toBeInTheDocument();
  });
});

// ─── Entry display ────────────────────────────────────────────────────────────

describe('Console entry display', () => {
  it('shows entry count', () => {
    const entries = [
      makeEntry('GET', '/users', 200),
      makeEntry('POST', '/login', 201),
    ];
    render(
      <ConsolePanel entries={entries} onClear={vi.fn()} isVisible tabId={TAB_ID} />,
    );
    expect(screen.getByText(/2 requests/i)).toBeInTheDocument();
  });

  it('shows "No requests recorded" when entries list is empty', () => {
    render(
      <ConsolePanel entries={[]} onClear={vi.fn()} isVisible tabId={TAB_ID} />,
    );
    expect(screen.getByText(/no requests recorded/i)).toBeInTheDocument();
  });
});

// ─── Filtering ────────────────────────────────────────────────────────────────

describe('Console filtering', () => {
  const entries = [
    makeEntry('GET', '/users', 200),
    makeEntry('POST', '/login', 201),
    makeEntry('DELETE', '/users/1', 404),
    makeEntry('GET', '/health', 500),
  ];

  it('status filter hides non-matching entries', async () => {
    const user = userEvent.setup({ delay: null });
    render(
      <ConsolePanel entries={entries} onClear={vi.fn()} isVisible tabId={TAB_ID} />,
    );

    const statusSelect = screen.getByRole('combobox', { name: /filter by status code/i });
    await user.selectOptions(statusSelect, '4xx');

    await waitFor(() => {
      expect(screen.getByText(/1 requests/i)).toBeInTheDocument();
    });
  });

  it('URL filter shows only matching entries', async () => {
    const user = userEvent.setup({ delay: null });
    render(
      <ConsolePanel entries={entries} onClear={vi.fn()} isVisible tabId={TAB_ID} />,
    );

    const urlInput = screen.getByRole('textbox', { name: /filter by url/i });
    await user.type(urlInput, '/users');

    await waitFor(() => {
      expect(screen.getByText(/2 requests/i)).toBeInTheDocument();
    });
  });
});

// ─── Clear ────────────────────────────────────────────────────────────────────

describe('Console clear', () => {
  it('calls onClear when Clear button is clicked', async () => {
    const user = userEvent.setup({ delay: null });
    const onClear = vi.fn();
    render(
      <ConsolePanel entries={[makeEntry('GET', '/test', 200)]} onClear={onClear} isVisible tabId={TAB_ID} />,
    );

    await user.click(screen.getByRole('button', { name: /^clear$/i }));
    expect(onClear).toHaveBeenCalledOnce();
  });
});

// ─── Tab store integration ────────────────────────────────────────────────────

describe('Tab store console entry integration', () => {
  it('addConsoleEntry adds entry for the correct tab', () => {
    useTabStore.getState().createTab();
    const activeTabId = useTabStore.getState().activeTabId!;
    useTabStore.getState().addConsoleEntry(activeTabId, makeEntry('GET', '/api/data', 200, activeTabId));

    expect(useTabStore.getState().consoleEntries[activeTabId]).toHaveLength(1);
    expect(useTabStore.getState().consoleEntries[activeTabId][0].request.method).toBe('GET');
  });

  it('clearConsoleEntries removes all entries for that tab', () => {
    useTabStore.getState().createTab();
    const activeTabId = useTabStore.getState().activeTabId!;
    useTabStore.getState().addConsoleEntry(activeTabId, makeEntry('GET', '/a', 200, activeTabId));
    useTabStore.getState().addConsoleEntry(activeTabId, makeEntry('POST', '/b', 201, activeTabId));

    expect(useTabStore.getState().consoleEntries[activeTabId]).toHaveLength(2);

    useTabStore.getState().clearConsoleEntries(activeTabId);

    expect(useTabStore.getState().consoleEntries[activeTabId]).toHaveLength(0);
  });

  it('entries have correct method, URL, and status code', () => {
    useTabStore.getState().createTab();
    const activeTabId = useTabStore.getState().activeTabId!;
    const entry = makeEntry('DELETE', '/api/users/5', 404, activeTabId);
    useTabStore.getState().addConsoleEntry(activeTabId, entry);

    const stored = useTabStore.getState().consoleEntries[activeTabId][0];
    expect(stored.request.method).toBe('DELETE');
    expect(stored.request.url).toBe('/api/users/5');
    expect(stored.response?.statusCode).toBe(404);
  });
});
