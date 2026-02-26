import React, { useRef, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { ChatMessage as ChatMessageType } from '../../../shared/types';
import { ChatMessage } from './ChatMessage';
import { LoadingSpinner } from '../common/LoadingSpinner';

interface ChatPanelProps {
  messages: ChatMessageType[];
  isGenerating?: boolean;
}

export function ChatPanel({ messages, isGenerating = false }: ChatPanelProps): React.JSX.Element {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 80,
    overscan: 5,
  });

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (messages.length > 0) {
      virtualizer.scrollToIndex(messages.length - 1, { align: 'end', behavior: 'smooth' });
    }
  }, [messages.length, virtualizer]);

  const items = virtualizer.getVirtualItems();

  return (
    <div className="flex h-full flex-col">
      <div
        ref={parentRef}
        className="flex-1 overflow-y-auto px-3 py-2"
        data-testid="chat-panel-list"
      >
        <div
          style={{
            height: virtualizer.getTotalSize(),
            width: '100%',
            position: 'relative',
          }}
        >
          {items.map((virtualItem) => {
            const message = messages[virtualItem.index];
            return (
              <div
                key={virtualItem.key}
                data-index={virtualItem.index}
                ref={virtualizer.measureElement}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualItem.start}px)`,
                }}
              >
                <ChatMessage message={message} />
              </div>
            );
          })}
        </div>

        {messages.length === 0 && !isGenerating && (
          <div className="flex h-full items-center justify-center text-[var(--color-text-secondary)]">
            <p className="text-sm">Start by pasting an API spec or URL above.</p>
          </div>
        )}
      </div>

      {isGenerating && (
        <div
          className="flex items-center gap-2 border-t border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-text-secondary)]"
          data-testid="generating-indicator"
          aria-live="polite"
          aria-label="Generating interface"
        >
          <LoadingSpinner size="sm" />
          <span>Generating interface…</span>
        </div>
      )}
    </div>
  );
}
