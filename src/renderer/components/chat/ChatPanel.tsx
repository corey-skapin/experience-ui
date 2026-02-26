// src/renderer/components/chat/ChatPanel.tsx
// Virtualized scrollable chat panel.
// Uses @tanstack/react-virtual for efficient DOM rendering of large message lists.

import { type JSX, useEffect, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

import type { ChatMessage as ChatMessageType } from '../../../shared/types';
import { ChatMessage } from './ChatMessage';
import { ClarificationCard } from './ClarificationCard';
import { LoadingSpinner } from '../common';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ClarificationState {
  question: string;
  options: string[];
  onSelect: (option: string) => void;
}

interface ChatPanelProps {
  messages: ChatMessageType[];
  isGenerating?: boolean;
  pendingCount?: number;
  clarification?: ClarificationState;
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyConversation(): JSX.Element {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        gap: 'var(--spacing-3)',
        color: 'var(--color-text-tertiary)',
      }}
      aria-label="Empty conversation"
    >
      <span role="img" aria-label="Chat bubble" style={{ fontSize: '2rem', lineHeight: 1 }}>
        💬
      </span>
      <span style={{ fontSize: 'var(--text-sm)' }}>Start a conversation</span>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ChatPanel({
  messages,
  isGenerating = false,
  pendingCount = 0,
  clarification,
}: ChatPanelProps): JSX.Element {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 80,
    overscan: 5,
  });

  // Stable ref so the scroll effect never includes `virtualizer` in its deps.
  // The method is always called with the latest virtualizer instance because the
  // ref is updated on every render before the effect fires (per React's contract).
  const scrollToBottomRef = useRef<() => void>(() => undefined);
  scrollToBottomRef.current = () => {
    if (messages.length > 0) {
      virtualizer.scrollToIndex(messages.length - 1, { align: 'end' });
    }
  };

  // Auto-scroll to the last message whenever messages are added or generation starts.
  useEffect(() => {
    scrollToBottomRef.current();
  }, [messages.length, isGenerating]);

  if (messages.length === 0 && !isGenerating) {
    return <EmptyConversation />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Virtualized scrollable message list */}
      <div
        ref={parentRef}
        style={{ flex: 1, overflowY: 'auto' }}
        role="log"
        aria-label="Chat messages"
        aria-live="polite"
        aria-atomic="false"
      >
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            position: 'relative',
          }}
        >
          {virtualizer.getVirtualItems().map((virtualItem) => (
            <div
              key={virtualItem.key}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualItem.start}px)`,
              }}
            >
              <ChatMessage message={messages[virtualItem.index]} />
            </div>
          ))}
        </div>
      </div>

      {/* Generating indicator */}
      {isGenerating && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--spacing-2)',
            padding: 'var(--spacing-2) var(--spacing-4)',
            borderTop: '1px solid var(--color-border-subtle)',
            color: 'var(--color-text-secondary)',
            fontSize: 'var(--text-sm)',
          }}
          role="status"
          aria-label="Generating response"
        >
          <LoadingSpinner size="sm" label="Generating response" />
          <span>Generating…</span>
        </div>
      )}

      {/* Clarification card */}
      {clarification && (
        <ClarificationCard
          question={clarification.question}
          options={clarification.options}
          onSelect={clarification.onSelect}
        />
      )}

      {/* Queued requests banner */}
      {pendingCount > 0 && (
        <div
          role="status"
          aria-label={`${pendingCount} request(s) queued`}
          style={{
            padding: 'var(--spacing-2) var(--spacing-4)',
            borderTop: '1px solid var(--color-border-subtle)',
            background: 'var(--color-surface-raised)',
            color: 'var(--color-text-secondary)',
            fontSize: 'var(--text-xs)',
          }}
        >
          ⏳ {pendingCount} request{pendingCount === 1 ? '' : 's'} queued
        </div>
      )}
    </div>
  );
}
