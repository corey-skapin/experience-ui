// tests/integration/customization.test.tsx
// T064 — Integration test: natural-language customization flow.
// Verifies queue → CLI → compile → sandbox update, and clarification handling.

import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { useTabStore } from '../../src/renderer/stores/tab-store';
import { useVersionStore } from '../../src/renderer/stores/version-store';
import { customizationQueue } from '../../src/renderer/services/customization-queue';

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
  PanelGroup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Panel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PanelResizeHandle: () => <div />,
}));

vi.mock('../../src/renderer/services/spec-parser/spec-parser', () => ({
  detectFormat: vi.fn().mockReturnValue('openapi3'),
  parseSpec: vi.fn().mockResolvedValue({ success: false, validationErrors: [] }),
}));

vi.mock('../../src/renderer/services/code-generator', () => ({
  generateInterface: vi.fn().mockResolvedValue({ success: false, error: 'skipped' }),
}));

// ─── window.experienceUI stub ─────────────────────────────────────────────────

const mockSendMessage = vi.fn();
const mockCompileCode = vi.fn();
const mockValidateCode = vi.fn();
const mockVersionsSaveSnapshot = vi.fn();
const mockVersionsList = vi.fn();

const mockExperienceUI = {
  cli: {
    sendMessage: mockSendMessage,
    getStatus: vi.fn(),
    restart: vi.fn(),
    onStatusChanged: vi.fn(() => vi.fn()),
    onStreamResponse: vi.fn(() => vi.fn()),
  },
  app: {
    getVersion: vi.fn(),
    compileCode: mockCompileCode,
    validateCode: mockValidateCode,
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
  versions: {
    saveSnapshot: mockVersionsSaveSnapshot,
    list: mockVersionsList,
    loadCode: vi.fn(),
    getDiff: vi.fn(),
  },
  plugins: {
    install: vi.fn(),
    uninstall: vi.fn(),
    list: vi.fn(),
    onStatusChanged: vi.fn(() => vi.fn()),
  },
};

// ─── Setup / Teardown ────────────────────────────────────────────────────────

const SPEC_LOADED_TAB = {
  id: 'tab-test',
  title: 'Test API',
  displayOrder: 0,
  isActive: true,
  apiSpec: {
    id: 'spec-1',
    format: 'openapi3' as const,
    source: { type: 'text' as const },
    rawContent: '{}',
    normalizedSpec: {
      format: 'openapi3' as const,
      metadata: { title: 'Test API', version: '1.0.0' },
      models: [],
    },
    validationStatus: 'valid' as const,
    validationErrors: [],
    metadata: { title: 'Test API', version: '1.0.0' },
    parsedAt: new Date().toISOString(),
  },
  generatedInterface: null,
  connectionId: null,
  chatHistory: [],
  customizationQueue: [],
  createdAt: new Date().toISOString(),
};

beforeEach(() => {
  vi.useRealTimers();

  // Clear queue state between tests to prevent stuck in-progress requests
  customizationQueue.clear('tab-test');

  Object.defineProperty(window, 'experienceUI', {
    value: mockExperienceUI,
    configurable: true,
    writable: true,
  });

  vi.clearAllMocks();

  mockSendMessage.mockResolvedValue({
    success: true,
    response: JSON.stringify({ code: 'const Updated = () => <div>updated</div>;' }),
    requestId: 'req-1',
  });

  mockCompileCode.mockResolvedValue({
    success: true,
    compiledCode: 'var Updated=()=>React.createElement("div",null,"updated");',
    warnings: [],
    bundleSizeBytes: 100,
  });

  mockValidateCode.mockResolvedValue({ valid: true, violations: [] });

  mockVersionsSaveSnapshot.mockResolvedValue({
    success: true,
    versionId: 'v-1',
    versionNumber: 1,
    codePath: '/data/v1/generated.tsx',
    codeHash: 'hash1',
  });

  mockVersionsList.mockResolvedValue({
    versions: [
      {
        id: 'v-1',
        versionNumber: 1,
        parentVersionId: null,
        changeType: 'customization',
        description: 'test',
        isRevert: false,
        createdAt: new Date().toISOString(),
      },
    ],
    totalCount: 1,
    page: 1,
    pageSize: 50,
  });

  useTabStore.setState({
    tabs: [SPEC_LOADED_TAB],
    activeTabId: SPEC_LOADED_TAB.id,
    tabStatuses: { [SPEC_LOADED_TAB.id]: 'interface-ready' as const },
    consoleEntries: {},
  });
  useVersionStore.setState({ versions: {}, currentVersionId: {}, isLoading: false, error: null });
});

// ─── Test helpers ─────────────────────────────────────────────────────────────

async function renderApp() {
  const { default: App } = await import('../../src/renderer/App');
  return render(<App />);
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Customization flow', () => {
  it('shows empty state when spec is loaded but no compiledCode yet', async () => {
    await renderApp();
    expect(screen.getByText('No interface loaded')).toBeInTheDocument();
  });

  it('sends customize request when spec is loaded and user sends a message', async () => {
    const user = userEvent.setup({ delay: null });
    await renderApp();

    const textarea = screen.getByRole('textbox', { name: /message input/i });
    await user.type(textarea, 'Add a search bar');
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(mockSendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('customize'),
        }),
      );
    });
  });

  it('shows user message in chat after sending customization', async () => {
    const user = userEvent.setup({ delay: null });
    await renderApp();

    await user.type(screen.getByRole('textbox', { name: /message input/i }), 'Add a search bar');
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(screen.getByText('Add a search bar')).toBeInTheDocument();
    });
  });

  it('shows success confirmation message after customization completes', async () => {
    const user = userEvent.setup({ delay: null });
    await renderApp();

    await user.type(screen.getByRole('textbox', { name: /message input/i }), 'Change to dark mode');
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(screen.getByText(/customization applied/i)).toBeInTheDocument();
    });
  });

  it('renders ClarificationCard when CLI returns clarificationNeeded: true', async () => {
    mockSendMessage.mockResolvedValueOnce({
      success: true,
      response: JSON.stringify({
        clarificationNeeded: true,
        question: 'Which layout do you prefer?',
        options: ['Grid', 'List'],
      }),
      requestId: 'req-clarify',
    });

    const user = userEvent.setup({ delay: null });
    await renderApp();

    await user.type(screen.getByRole('textbox', { name: /message input/i }), 'Change layout');
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(screen.getByText('Which layout do you prefer?')).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /select option: grid/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /select option: list/i })).toBeInTheDocument();
  });

  it('shows error message when customization fails', async () => {
    mockSendMessage.mockResolvedValueOnce({
      success: false,
      error: 'CLI unavailable',
      requestId: 'req-fail',
    });

    const user = userEvent.setup({ delay: null });
    await renderApp();

    await user.type(screen.getByRole('textbox', { name: /message input/i }), 'Break something');
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(screen.getByText(/customization error/i)).toBeInTheDocument();
    });
  });
});
