// src/renderer/App.tsx
// T041/T063/T074 — Application shell with customization and version history.
// Left pane: ChatPanel + ChatInput + VersionTimeline (collapsible)
// Right pane: SandboxHost
import type { JSX } from 'react';
import { useCallback, useState } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';

import { TooltipProvider } from './components/common/Tooltip';
import { ProgressBar, EmptyState } from './components/common';
import { ChatPanel } from './components/chat/ChatPanel';
import { ChatInput } from './components/chat/ChatInput';
import { SandboxHost } from './components/sandbox/SandboxHost';
import { VersionTimeline } from './components/versions/VersionTimeline';
import { useAppStore } from './stores/app-store';
import { useTabStore } from './stores/tab-store';
import { detectFormat, parseSpec } from './services/spec-parser/spec-parser';
import { generateInterface } from './services/code-generator';
import { useCli } from './hooks/use-cli';
import { useCustomization } from './hooks/use-customization';
import { useVersions } from './hooks/use-versions';
import type { ChatMessage } from '../shared/types';
import { MIN_CHAT_PANEL_WIDTH_PERCENT, MAX_CHAT_PANEL_WIDTH_PERCENT } from '../shared/constants';

// ─── App ─────────────────────────────────────────────────────────────────────

export default function App(): JSX.Element {
  const theme = useAppStore((s) => s.theme);
  const { tab, addChatMessage, loadSpec, startGenerating, finishGenerating } = useTabStore();

  const [compiledCode, setCompiledCode] = useState<string | null>(null);
  const [rawCode, setRawCode] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState('');
  const [sandboxError, setSandboxError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showVersions, setShowVersions] = useState(false);

  const cli = useCli();
  const customization = useCustomization();
  const versions = useVersions(tab.id, tab.id);

  // ── Helpers ────────────────────────────────────────────────────────────────

  const appendMessage = useCallback(
    (role: ChatMessage['role'], content: string, status: ChatMessage['status'] = 'sent') => {
      const msg: ChatMessage = {
        id: crypto.randomUUID(),
        tabId: tab.id,
        role,
        content,
        timestamp: new Date().toISOString(),
        status,
        relatedVersionId: null,
      };
      addChatMessage(msg);
      return msg.id;
    },
    [tab.id, addChatMessage],
  );

  // ── Apply new code (compile + validate + update sandbox) ───────────────────

  const applyCode = useCallback(
    async (newRawCode: string): Promise<boolean> => {
      const compileResult = await window.experienceUI.app.compileCode({
        sourceCode: newRawCode,
        format: 'iife',
        target: 'es2020',
        minify: false,
      });
      if (!compileResult.success) {
        appendMessage(
          'system',
          `Compile error: ${compileResult.errors?.[0]?.message ?? 'Unknown'}`,
        );
        return false;
      }
      const validateResult = await window.experienceUI.app.validateCode({
        code: compileResult.compiledCode ?? '',
      });
      if (!validateResult.valid) {
        appendMessage('system', 'Validation failed: code contains disallowed patterns.');
        return false;
      }
      setRawCode(newRawCode);
      setCompiledCode(compileResult.compiledCode ?? null);
      return true;
    },
    [appendMessage],
  );

  // ── Customization path ────────────────────────────────────────────────────

  const handleCustomize = useCallback(
    async (text: string) => {
      appendMessage('user', text);
      const chatHistory = tab.chatHistory.map((m) => ({ role: m.role, content: m.content }));
      const specContext = JSON.stringify(tab.apiSpec?.normalizedSpec ?? {});

      await customization.runCustomization(
        tab.id,
        text,
        rawCode ?? '',
        specContext,
        chatHistory,
        cli.customize,
        async (newCode) => {
          const applied = await applyCode(newCode);
          if (applied) {
            appendMessage('assistant', 'Customization applied successfully.');
            await versions
              .saveSnapshot(newCode, text.slice(0, 80), 'customization')
              .catch(() => undefined);
          }
        },
        (errMsg) => appendMessage('system', `Customization error: ${errMsg}`),
      );
    },
    [tab, rawCode, cli.customize, customization, appendMessage, applyCode, versions],
  );

  // ── Spec loading + initial generation ─────────────────────────────────────

  const handleLoad = useCallback(
    async (text: string, attachment?: File) => {
      setIsProcessing(true);
      setSandboxError(null);
      appendMessage('user', text.trim() || (attachment ? `Attached: ${attachment.name}` : ''));

      try {
        let rawContent: string;
        if (attachment) {
          rawContent = await attachment.text();
        } else if (text.startsWith('http://') || text.startsWith('https://')) {
          let parsedUrl: URL;
          try {
            parsedUrl = new URL(text);
          } catch {
            appendMessage('system', 'Error: Invalid URL — please provide a valid http(s) URL.');
            return;
          }
          if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
            appendMessage('system', 'Error: Only http:// and https:// URLs are supported.');
            return;
          }
          setProgressLabel('Fetching spec…');
          setProgress(10);
          const res = await fetch(text);
          rawContent = await res.text();
        } else {
          rawContent = text;
        }

        setProgressLabel('Parsing spec…');
        setProgress(25);
        const format = detectFormat(rawContent);
        const parseResult = await parseSpec(rawContent, format);

        if (!parseResult.success || !parseResult.spec) {
          appendMessage(
            'system',
            `Error: ${parseResult.validationErrors[0]?.message ?? 'Failed to parse the API spec.'}`,
          );
          return;
        }

        loadSpec({
          id: crypto.randomUUID(),
          format: parseResult.spec.format,
          source: attachment
            ? { type: 'file', fileName: attachment.name, filePath: '' }
            : text.startsWith('http')
              ? { type: 'url', url: text }
              : { type: 'text' },
          rawContent,
          normalizedSpec: parseResult.spec,
          validationStatus:
            parseResult.validationErrors.length === 0
              ? 'valid'
              : parseResult.validationErrors.some((e) => e.severity === 'error')
                ? 'invalid'
                : 'warnings',
          validationErrors: parseResult.validationErrors,
          metadata: parseResult.spec.metadata,
          parsedAt: new Date().toISOString(),
        });

        appendMessage('system', `Loaded: ${parseResult.spec.metadata.title}`);

        setProgressLabel('Generating interface…');
        setProgress(50);
        startGenerating();

        const genResult = await generateInterface(parseResult.spec);
        if (!genResult.success) {
          appendMessage('system', `Generation failed: ${genResult.error}`);
          return;
        }

        setProgress(90);
        setRawCode(genResult.rawCode);
        setCompiledCode(genResult.compiledCode);
        finishGenerating();
        setProgress(100);
        appendMessage('assistant', 'Interface generated successfully. Preview is ready.');
        await versions
          .saveSnapshot(
            genResult.rawCode,
            `Generated from ${parseResult.spec.metadata.title}`,
            'generation',
          )
          .catch(() => undefined);
      } catch (err) {
        appendMessage('system', `Error: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        setIsProcessing(false);
        setProgressLabel('');
        setProgress(0);
      }
    },
    [appendMessage, loadSpec, startGenerating, finishGenerating, versions],
  );

  // ── Rollback ──────────────────────────────────────────────────────────────

  const handleRollback = useCallback(
    async (versionId: string) => {
      try {
        const { code } = await versions.rollback(versionId);
        const applied = await applyCode(code);
        if (applied) appendMessage('assistant', 'Rolled back to previous version.');
      } catch (err) {
        appendMessage(
          'system',
          `Rollback failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    },
    [versions, applyCode, appendMessage],
  );

  // ── Unified send handler ───────────────────────────────────────────────────

  const handleSend = useCallback(
    async (text: string, attachment?: File) => {
      if (isProcessing || customization.isCustomizing) return;
      if (tab.apiSpec && !attachment) {
        await handleCustomize(text);
      } else {
        await handleLoad(text, attachment);
      }
    },
    [isProcessing, customization.isCustomizing, tab.apiSpec, handleCustomize, handleLoad],
  );

  const pendingCount = customization.queueDepth;

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
        {isProcessing && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100 }}>
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
              messages={tab.chatHistory}
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
            {/* Version history toggle */}
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
              <div
                style={{
                  maxHeight: 220,
                  overflow: 'hidden',
                  borderTop: '1px solid var(--color-border-default)',
                }}
              >
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
            style={{
              width: 4,
              background: 'var(--color-border-default)',
              cursor: 'col-resize',
              flexShrink: 0,
            }}
          />

          <Panel style={{ overflow: 'hidden' }}>
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
          </Panel>
        </PanelGroup>
      </TooltipProvider>
    </div>
  );
}
