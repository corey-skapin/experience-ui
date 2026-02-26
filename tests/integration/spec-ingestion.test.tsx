// tests/integration/spec-ingestion.test.tsx
// T043 — Integration test for the full spec-to-interface flow.
// Covers: parsing → generation → sandbox render trigger, and error display for invalid specs.

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useTabStore } from '../../src/renderer/stores/tab-store';

// ─── Hoist mock data so it is available inside vi.mock factory closures ────────

const MOCK_NORMALIZED_SPEC = vi.hoisted(() => ({
  format: 'openapi3' as const,
  metadata: { title: 'Petstore API', version: '1.0.0' },
  endpoints: [] as never[],
  models: [] as never[],
}));

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getVirtualItems: () =>
      Array.from({ length: count }, (_, i) => ({ key: i, index: i, start: i * 80, size: 80 })),
    getTotalSize: () => count * 80,
    scrollToIndex: vi.fn(),
  }),
}));

vi.mock('react-resizable-panels', () => ({
  PanelGroup: ({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) => (
    <div data-testid="panel-group" style={style}>
      {children}
    </div>
  ),
  Panel: ({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) => (
    <div data-testid="panel" style={style}>
      {children}
    </div>
  ),
  PanelResizeHandle: () => <div data-testid="resize-handle" />,
}));

vi.mock('../../src/renderer/services/spec-parser/spec-parser', () => ({
  detectFormat: vi.fn(),
  parseSpec: vi.fn(),
}));

vi.mock('../../src/renderer/services/code-generator', () => ({
  generateInterface: vi.fn(),
}));

// ─── Static imports of mocked modules (receive mock instances via vi.mock) ────

import { parseSpec, detectFormat } from '../../src/renderer/services/spec-parser/spec-parser';
import { generateInterface } from '../../src/renderer/services/code-generator';

// ─── window.experienceUI stub ─────────────────────────────────────────────────

const mockCliOnStatusChanged = vi.fn(() => vi.fn());
const mockCliOnStreamResponse = vi.fn(() => vi.fn());

const mockExperienceUI = {
  cli: {
    sendMessage: vi.fn(),
    getStatus: vi.fn(),
    restart: vi.fn(),
    onStatusChanged: mockCliOnStatusChanged,
    onStreamResponse: mockCliOnStreamResponse,
  },
  app: {
    getVersion: vi.fn(),
    compileCode: vi.fn(),
    validateCode: vi.fn(),
  },
  auth: {
    configure: vi.fn(),
    testConnection: vi.fn(),
    getConnectionStatus: vi.fn(),
    startOAuthFlow: vi.fn(),
    clearCredentials: vi.fn(),
    onTokenExpired: vi.fn(() => vi.fn()),
    onTokenRefreshed: vi.fn(() => vi.fn()),
    onConnectionStatusChanged: vi.fn(() => vi.fn()),
  },
  proxy: { apiRequest: vi.fn() },
  versions: { saveSnapshot: vi.fn(), list: vi.fn(), loadCode: vi.fn(), getDiff: vi.fn() },
  plugins: {
    install: vi.fn(),
    uninstall: vi.fn(),
    list: vi.fn(),
    onStatusChanged: vi.fn(() => vi.fn()),
  },
};

// ─── Setup / Teardown ────────────────────────────────────────────────────────

beforeEach(() => {
  vi.useRealTimers();

  Object.defineProperty(window, 'experienceUI', {
    value: mockExperienceUI,
    configurable: true,
    writable: true,
  });

  // Reset call history without removing implementations.
  vi.clearAllMocks();

  // Restore mock implementations after clearAllMocks.
  vi.mocked(detectFormat).mockReturnValue('openapi3');
  vi.mocked(parseSpec).mockResolvedValue({
    success: true,
    spec: MOCK_NORMALIZED_SPEC,
    validationErrors: [],
  });
  vi.mocked(generateInterface).mockResolvedValue({
    success: true,
    rawCode: 'console.log("hello")',
    compiledCode: '(function(){console.log("hello");})()',
  });
  mockCliOnStatusChanged.mockReturnValue(vi.fn());
  mockCliOnStreamResponse.mockReturnValue(vi.fn());

  useTabStore.setState({
    tab: {
      id: crypto.randomUUID(),
      title: 'New Tab',
      displayOrder: 0,
      isActive: true,
      apiSpec: null,
      generatedInterface: null,
      connectionId: null,
      chatHistory: [],
      customizationQueue: [],
      createdAt: new Date().toISOString(),
    },
    tabStatus: 'empty',
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── Import helpers ───────────────────────────────────────────────────────────

async function renderApp() {
  const { default: App } = await import('../../src/renderer/App');
  return render(<App />);
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Spec ingestion — happy path', () => {
  it('renders the empty state before any spec is submitted', async () => {
    await renderApp();
    expect(screen.getByText('No interface loaded')).toBeInTheDocument();
  });

  it('shows start conversation placeholder in the chat panel', async () => {
    await renderApp();
    expect(screen.getByText('Start a conversation')).toBeInTheDocument();
  });

  it('displays user message after sending a spec', async () => {
    const user = userEvent.setup({ delay: null });
    await renderApp();

    await user.type(screen.getByRole('textbox', { name: /message input/i }), 'openapi spec here');
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(screen.getByText('openapi spec here')).toBeInTheDocument();
    });
  });

  it('shows parsed spec title in a system message', async () => {
    const user = userEvent.setup({ delay: null });
    await renderApp();

    await user.type(screen.getByRole('textbox', { name: /message input/i }), 'my api spec');
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(screen.getByText(/Petstore API/i)).toBeInTheDocument();
    });
  });

  it('transitions tabStatus to interface-ready after successful generation', async () => {
    const user = userEvent.setup({ delay: null });
    await renderApp();

    await user.type(screen.getByRole('textbox', { name: /message input/i }), 'my api spec');
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(useTabStore.getState().tabStatus).toBe('interface-ready');
    });
  });
});

describe('Spec ingestion — error paths', () => {
  it('shows error message when spec parsing fails', async () => {
    vi.mocked(parseSpec).mockResolvedValueOnce({
      success: false,
      validationErrors: [{ path: '', message: 'Unsupported format.', severity: 'error' }],
    });

    const user = userEvent.setup({ delay: null });
    await renderApp();

    await user.type(screen.getByRole('textbox', { name: /message input/i }), 'NOT_A_VALID_SPEC');
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(screen.getByText(/Error: Unsupported format\./i)).toBeInTheDocument();
    });
  });

  it('shows error message when code generation fails', async () => {
    vi.mocked(generateInterface).mockResolvedValueOnce({
      success: false,
      error: 'CLI timed out',
    });

    const user = userEvent.setup({ delay: null });
    await renderApp();

    await user.type(screen.getByRole('textbox', { name: /message input/i }), 'my api spec');
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(screen.getByText(/Generation failed: CLI timed out/i)).toBeInTheDocument();
    });
  });

  it('does not show sandbox preview when generation fails', async () => {
    vi.mocked(generateInterface).mockResolvedValueOnce({
      success: false,
      error: 'Compilation error',
    });

    const user = userEvent.setup({ delay: null });
    await renderApp();

    await user.type(screen.getByRole('textbox', { name: /message input/i }), 'my api spec');
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(screen.getByText(/Generation failed/i)).toBeInTheDocument();
    });
    expect(screen.getByText('No interface loaded')).toBeInTheDocument();
  });
});

describe('Zustand store state', () => {
  it('starts in empty tabStatus', () => {
    expect(useTabStore.getState().tabStatus).toBe('empty');
  });

  it('resets between tests', () => {
    expect(useTabStore.getState().tabStatus).toBe('empty');
    expect(useTabStore.getState().tab.chatHistory).toHaveLength(0);
  });
});
