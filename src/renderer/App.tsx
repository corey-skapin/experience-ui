import React, { useState, useCallback } from 'react';
import { Group, Panel, Separator } from 'react-resizable-panels';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { useAppStore } from './stores/app-store';
import { ChatPanel } from './components/chat/ChatPanel';
import { ChatInput } from './components/chat/ChatInput';
import { SandboxHost } from './components/sandbox/SandboxHost';
import { ProgressBar } from './components/common/ProgressBar';
import { EmptyState } from './components/common/EmptyState';
import { parseSpec } from './services/spec-parser/spec-parser';
import { generateCode } from './services/code-generator/index';
import { useTabStore } from './stores/tab-store';
import type { ChatMessage } from '../shared/types';
import {
  MIN_CHAT_PANEL_WIDTH,
  MAX_CHAT_PANEL_WIDTH,
  DEFAULT_CHAT_PANEL_WIDTH,
} from '../shared/constants';

function generateId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function App(): React.JSX.Element {
  const theme = useAppStore((s) => s.theme);
  const { tab, status, addMessage, setSpec, setGeneratedInterface, setStatus } = useTabStore();
  const [compiledCode, setCompiledCode] = useState<string | undefined>(undefined);
  const [isGenerating, setIsGenerating] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  const processInput = useCallback(
    async (text: string, file?: File): Promise<void> => {
      setParseError(null);

      const userMsg: ChatMessage = {
        id: generateId(),
        tabId: tab.id,
        role: 'user',
        content: file ? `Uploaded: ${file.name}` : text,
        timestamp: new Date().toISOString(),
        status: 'sent',
        relatedVersionId: null,
      };
      addMessage(userMsg);

      let rawContent = text;
      if (file) {
        rawContent = await file.text();
      }

      if (!rawContent.trim()) return;

      setStatus('generating');
      setIsGenerating(true);

      const parseResult = await parseSpec(rawContent);
      if (!parseResult.success) {
        const errors = parseResult.errors.map((e) => e.message).join('; ');
        setParseError(errors);
        setStatus(tab.apiSpec ? 'spec-loaded' : 'empty');
        setIsGenerating(false);

        addMessage({
          id: generateId(),
          tabId: tab.id,
          role: 'system',
          content: `Error: ${errors}`,
          timestamp: new Date().toISOString(),
          status: 'error',
          relatedVersionId: null,
        });
        return;
      }

      setSpec({
        id: `spec-${Date.now()}`,
        format: parseResult.spec.format,
        source: { type: 'text' },
        rawContent,
        normalizedSpec: parseResult.spec,
        validationStatus: 'valid',
        metadata: parseResult.spec.metadata,
        parsedAt: new Date().toISOString(),
      });

      addMessage({
        id: generateId(),
        tabId: tab.id,
        role: 'assistant',
        content: `Parsed ${parseResult.spec.format} spec: "${parseResult.spec.metadata.title}". Generating interface…`,
        timestamp: new Date().toISOString(),
        status: 'sent',
        relatedVersionId: null,
      });

      try {
        const genResult = await generateCode(parseResult.spec);
        if (genResult.success && genResult.compiledCode) {
          setCompiledCode(genResult.compiledCode);
          setGeneratedInterface({
            id: `iface-${Date.now()}`,
            tabId: tab.id,
            apiSpecId: `spec-${Date.now()}`,
            currentVersionId: 'v1',
            versions: [],
            sandboxState: { status: 'active', iframeRef: 'iframe-1' },
            createdAt: new Date().toISOString(),
          });
          addMessage({
            id: generateId(),
            tabId: tab.id,
            role: 'assistant',
            content: 'Interface generated successfully. You can now interact with it on the right.',
            timestamp: new Date().toISOString(),
            status: 'sent',
            relatedVersionId: null,
          });
        } else {
          const errMsg = genResult.errors?.map((e) => e.message).join('; ') ?? 'Generation failed';
          setParseError(errMsg);
          addMessage({
            id: generateId(),
            tabId: tab.id,
            role: 'system',
            content: `Generation error: ${errMsg}`,
            timestamp: new Date().toISOString(),
            status: 'error',
            relatedVersionId: null,
          });
        }
      } finally {
        setIsGenerating(false);
        setStatus(compiledCode ? 'interface-ready' : 'spec-loaded');
      }
    },
    [tab, addMessage, setSpec, setGeneratedInterface, setStatus, compiledCode],
  );

  const chatMinSize = MIN_CHAT_PANEL_WIDTH;
  const chatMaxSize = MAX_CHAT_PANEL_WIDTH;
  const chatDefaultSize = DEFAULT_CHAT_PANEL_WIDTH;

  return (
    <ErrorBoundary>
      <div
        data-theme={theme}
        className="flex h-full w-full flex-col overflow-hidden bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]"
        data-testid="app-root"
      >
        {isGenerating && (
          <ProgressBar value={0} label="Generating interface…" data-testid="generation-progress" />
        )}

        <Group orientation="horizontal" className="flex-1">
          <Panel
            defaultSize={chatDefaultSize}
            minSize={chatMinSize}
            maxSize={chatMaxSize}
            className="flex flex-col"
          >
            <div className="flex h-full flex-col">
              {tab.chatHistory.length === 0 && !isGenerating ? (
                <EmptyState
                  title="Welcome to Experience UI"
                  description="Paste an OpenAPI, Swagger, or GraphQL spec below to generate a live interface."
                  data-testid="chat-empty-state"
                />
              ) : (
                <ChatPanel messages={tab.chatHistory} isGenerating={isGenerating} />
              )}
              {parseError && (
                <div
                  className="border-t border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
                  role="alert"
                  data-testid="parse-error"
                >
                  {parseError}
                </div>
              )}
              <ChatInput
                onSubmit={(msg, file) => void processInput(msg, file)}
                isDisabled={isGenerating}
              />
            </div>
          </Panel>

          <Separator
            className="w-1 cursor-col-resize bg-[var(--color-border)] hover:bg-[var(--color-accent)]"
            aria-label="Resize panels"
          />

          <Panel className="flex flex-col">
            {status === 'empty' && !compiledCode ? (
              <EmptyState
                title="No interface loaded"
                description="Your generated interface will appear here."
                data-testid="content-empty-state"
              />
            ) : (
              <SandboxHost compiledCode={compiledCode} theme={theme} />
            )}
          </Panel>
        </Group>
      </div>
    </ErrorBoundary>
  );
}
