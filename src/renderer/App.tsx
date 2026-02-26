// src/renderer/App.tsx
// T041 — Full application shell with split-pane layout.
// Left pane (30%): ChatPanel + ChatInput
// Right pane (70%): SandboxHost
// Wires the full flow: chat input → spec detection → parse → generate → sandbox render.
import type { JSX } from 'react';
import { useCallback, useState } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';

import { TooltipProvider } from './components/common/Tooltip';
import { ProgressBar, EmptyState } from './components/common';
import { ChatPanel } from './components/chat/ChatPanel';
import { ChatInput } from './components/chat/ChatInput';
import { SandboxHost } from './components/sandbox/SandboxHost';
import { useAppStore } from './stores/app-store';
import { useTabStore } from './stores/tab-store';
import { detectFormat, parseSpec } from './services/spec-parser/spec-parser';
import { generateInterface } from './services/code-generator';
import type { ChatMessage } from '../shared/types';
import { MIN_CHAT_PANEL_WIDTH_PERCENT, MAX_CHAT_PANEL_WIDTH_PERCENT } from '../shared/constants';

// ─── App ─────────────────────────────────────────────────────────────────────

export default function App(): JSX.Element {
  const theme = useAppStore((s) => s.theme);
  const { tab, addChatMessage, loadSpec, startGenerating, finishGenerating } = useTabStore();

  const [compiledCode, setCompiledCode] = useState<string | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [progressLabel, setProgressLabel] = useState<string>('');
  const [sandboxError, setSandboxError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

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

  // ── Send handler ────────────────────────────────────────────────────────────

  const handleSend = useCallback(
    async (text: string, attachment?: File) => {
      if (isProcessing) return;
      setIsProcessing(true);
      setSandboxError(null);

      // Record the user message
      appendMessage('user', text.trim() || (attachment ? `Attached: ${attachment.name}` : ''));

      try {
        let rawContent: string;

        // ── Step 1: Get spec content ─────────────────────────────────────────
        if (attachment) {
          rawContent = await attachment.text();
        } else if (text.startsWith('http://') || text.startsWith('https://')) {
          // Validate the URL is well-formed before fetching.
          let parsedUrl: URL;
          try {
            parsedUrl = new URL(text);
          } catch {
            appendMessage('system', 'Error: Invalid URL — please provide a valid http(s) URL.');
            return;
          }
          // Only allow http/https schemes (block file://, data:, etc.).
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

        // ── Step 2: Parse spec ───────────────────────────────────────────────
        setProgressLabel('Parsing spec…');
        setProgress(25);
        const format = detectFormat(rawContent);
        const parseResult = await parseSpec(rawContent, format);

        if (!parseResult.success || !parseResult.spec) {
          const errMsg =
            parseResult.validationErrors[0]?.message ?? 'Failed to parse the API spec.';
          appendMessage('system', `Error: ${errMsg}`);
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

        // ── Step 3: Generate interface ───────────────────────────────────────
        setProgressLabel('Generating interface…');
        setProgress(50);
        startGenerating();

        const genResult = await generateInterface(parseResult.spec);

        if (!genResult.success) {
          appendMessage('system', `Generation failed: ${genResult.error}`);
          return;
        }

        setProgress(90);
        setCompiledCode(genResult.compiledCode);
        finishGenerating();
        setProgress(100);
        appendMessage('assistant', 'Interface generated successfully. Preview is ready.');
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        appendMessage('system', `Error: ${msg}`);
      } finally {
        setIsProcessing(false);
        setProgressLabel('');
        setProgress(0);
      }
    },
    [isProcessing, appendMessage, loadSpec, startGenerating, finishGenerating],
  );

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
        {/* Progress bar */}
        {isProcessing && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100 }}>
            <ProgressBar value={progress} label={progressLabel} />
          </div>
        )}

        <PanelGroup direction="horizontal" style={{ flex: 1, minHeight: 0 }}>
          {/* Left pane: Chat */}
          <Panel
            defaultSize={30}
            minSize={MIN_CHAT_PANEL_WIDTH_PERCENT}
            maxSize={MAX_CHAT_PANEL_WIDTH_PERCENT}
            style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
          >
            <ChatPanel messages={tab.chatHistory} isGenerating={isProcessing} />
            <ChatInput onSend={(t, f) => void handleSend(t, f)} disabled={isProcessing} />
          </Panel>

          <PanelResizeHandle
            style={{
              width: 4,
              background: 'var(--color-border-default)',
              cursor: 'col-resize',
              flexShrink: 0,
            }}
          />

          {/* Right pane: Sandbox preview */}
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
