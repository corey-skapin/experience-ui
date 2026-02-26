// src/renderer/App.tsx
// T041/T063/T074/T083/T092 — Application shell with multi-tab support and debug console.
// Layout: TabBar → (left: chat + versions | right: sandbox + console)
import type { JSX } from 'react';
import { useCallback, useEffect, useMemo } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';

import { TooltipProvider } from './components/common/Tooltip';
import { ProgressBar, EmptyState } from './components/common';
import { ChatPanel } from './components/chat/ChatPanel';
import { ChatInput } from './components/chat/ChatInput';
import { SandboxHost } from './components/sandbox/SandboxHost';
import { VersionTimeline } from './components/versions/VersionTimeline';
import { TabBar } from './components/tabs/TabBar';
import { ConsolePanel } from './components/console/ConsolePanel';
import { useAppStore } from './stores/app-store';
import { useTabStore, selectActiveTab, selectConsoleEntries } from './stores/tab-store';
import { useTabs } from './hooks/use-tabs';
import { useTabHandlers } from './hooks/use-tab-handlers';
import { MIN_CHAT_PANEL_WIDTH_PERCENT, MAX_CHAT_PANEL_WIDTH_PERCENT } from '../shared/constants';

// ─── App ─────────────────────────────────────────────────────────────────────

export default function App(): JSX.Element {
  const theme = useAppStore((s) => s.theme);
  const consoleVisible = useAppStore((s) => s.consoleVisible);
  const toggleConsole = useAppStore((s) => s.toggleConsole);

  const activeTab = useTabStore(selectActiveTab);
  const activeTabId = useTabStore((s) => s.activeTabId);
  // Stable selector: memoize by activeTabId to avoid creating new function each render
  const consoleEntriesSelector = useMemo(
    () => selectConsoleEntries(activeTabId ?? ''),
    [activeTabId],
  );
  const consoleEntries = useTabStore(consoleEntriesSelector);
  const clearConsoleEntries = useTabStore((s) => s.clearConsoleEntries);

  const { tabs, createTab, switchTab, renameTab } = useTabs();

  const {
    compiledCode, progress, progressLabel, sandboxError, isProcessing,
    showVersions, setShowVersions, setSandboxError,
    customization, versions,
    handleSend, handleRollback, applyCode,
  } = useTabHandlers(activeTab);

  // ── Keyboard shortcut: Ctrl/Cmd+J toggles console ────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'j') {
        e.preventDefault();
        toggleConsole();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggleConsole]);

  const pendingCount = customization.queueDepth;

  const handleClearConsole = useCallback(() => {
    if (activeTabId) clearConsoleEntries(activeTabId);
  }, [activeTabId, clearConsoleEntries]);

  return (
    <div
      data-theme={theme}
      className={theme}
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        background: 'var(--color-bg-primary)',
        color: 'var(--color-text-primary)',
        fontFamily: 'var(--font-sans)',
      }}
    >
      <TooltipProvider>
        {/* Tab bar */}
        <TabBar
          tabs={tabs}
          activeTabId={activeTabId}
          onNewTab={createTab}
          onSwitchTab={switchTab}
          onRenameTab={renameTab}
        />

        {isProcessing && (
          <div style={{ position: 'fixed', top: 36, left: 0, right: 0, zIndex: 100 }}>
            <ProgressBar value={progress} label={progressLabel} />
          </div>
        )}

        <PanelGroup direction="horizontal" style={{ flex: 1, minHeight: 0 }}>
          <Panel
            defaultSize={30}
            minSize={MIN_CHAT_PANEL_WIDTH_PERCENT}
            maxSize={MAX_CHAT_PANEL_WIDTH_PERCENT}
            style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
          >
            <ChatPanel
              messages={activeTab?.chatHistory ?? []}
              isGenerating={isProcessing}
              pendingCount={pendingCount}
              clarification={customization.clarification ?? undefined}
            />
            <ChatInput
              onSend={(t, f) => void handleSend(t, f)}
              disabled={isProcessing}
              isCustomizing={customization.isCustomizing}
              queueDepth={customization.queueDepth}
            />
            {compiledCode && (
              <button
                type="button"
                onClick={() => setShowVersions((v) => !v)}
                style={{
                  padding: 'var(--spacing-2)',
                  fontSize: 'var(--text-xs)',
                  background: 'var(--color-surface-raised)',
                  border: 'none',
                  borderTop: '1px solid var(--color-border-default)',
                  cursor: 'pointer',
                  color: 'var(--color-text-secondary)',
                }}
                aria-label="Toggle version history"
              >
                {showVersions ? '▲ Hide' : '▼ Show'} Version History ({versions.versions.length})
              </button>
            )}
            {showVersions && (
              <div style={{ maxHeight: 220, overflow: 'hidden', borderTop: '1px solid var(--color-border-default)' }}>
                <VersionTimeline
                  versions={versions.versions}
                  currentVersionId={versions.currentVersionId}
                  onRollback={(id) => void handleRollback(id)}
                  onLoad={(id) => void versions.loadVersion(id).then(applyCode)}
                />
              </div>
            )}
          </Panel>

          <PanelResizeHandle
            style={{ width: 4, background: 'var(--color-border-default)', cursor: 'col-resize', flexShrink: 0 }}
          />

          <Panel style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
              {compiledCode ? (
                <SandboxHost
                  compiledCode={compiledCode}
                  theme={theme}
                  onReady={() => setSandboxError(null)}
                  onError={(err) => setSandboxError(err)}
                />
              ) : (
                <EmptyState
                  title="No interface loaded"
                  description="Paste an API spec URL or upload a .json / .yaml / .graphql file in the chat to generate a UI."
                  style={{ height: '100%' }}
                />
              )}
              {sandboxError && (
                <div
                  role="alert"
                  style={{
                    position: 'absolute',
                    bottom: 'var(--spacing-4)',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    padding: 'var(--spacing-3) var(--spacing-4)',
                    background: 'var(--color-status-error-bg)',
                    border: '1px solid var(--color-status-error)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--color-status-error)',
                    fontSize: 'var(--text-sm)',
                    maxWidth: '480px',
                    zIndex: 50,
                  }}
                >
                  {sandboxError}
                </div>
              )}
            </div>
            <ConsolePanel
              entries={consoleEntries}
              onClear={handleClearConsole}
              isVisible={consoleVisible}
              tabId={activeTabId ?? ''}
            />
          </Panel>
        </PanelGroup>
      </TooltipProvider>
    </div>
  );
}
