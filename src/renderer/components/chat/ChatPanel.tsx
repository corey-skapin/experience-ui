/**
 * ChatPanel component.
 * Virtualized message list using @tanstack/react-virtual.
 * Auto-scrolls to bottom on new messages.
 * Shows user/assistant/system messages, generation progress, and
 * an inline clarification prompt when the CLI needs user input.
 */
import { useEffect, useRef, useCallback, type ReactElement } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { ChatMessage as ChatMessageType } from '../../../shared/types'
import { ChatMessage } from './ChatMessage'
import { ChatInput } from './ChatInput'
import { LoadingSpinner } from '../common/LoadingSpinner'
import { ProgressBar } from '../common/ProgressBar'
import { EmptyState } from '../common/EmptyState'

// ─── Types ────────────────────────────────────────────────────────────────

export interface PendingClarification {
  question: string
  options: string[]
  onSelect: (option: string) => void
}

interface ChatPanelProps {
  messages: ChatMessageType[]
  onSendMessage: (
    content: string,
    file?: { name: string; content: string; mimeType: string },
  ) => void
  isGenerating?: boolean
  generationProgress?: number
  generationStage?: string
  disabled?: boolean
  queueDepth?: number
  /** When set, shows a clarification prompt and disables the input. */
  pendingClarification?: PendingClarification | null
}

// ─── Component ────────────────────────────────────────────────────────────

export function ChatPanel({
  messages,
  onSendMessage,
  isGenerating = false,
  generationProgress = 0,
  generationStage,
  disabled = false,
  queueDepth = 0,
  pendingClarification = null,
}: ChatPanelProps): ReactElement {
  const parentRef = useRef<HTMLDivElement>(null)
  const isAtBottomRef = useRef(true)

  const rowVirtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 80,
    overscan: 5,
  })

  // Auto-scroll to bottom on new messages when user is at bottom
  useEffect(() => {
    if (isAtBottomRef.current && messages.length > 0) {
      rowVirtualizer.scrollToIndex(messages.length - 1, { behavior: 'smooth' })
    }
  }, [messages.length, rowVirtualizer])

  const handleScroll = useCallback(() => {
    const el = parentRef.current
    if (!el) return
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    isAtBottomRef.current = distanceFromBottom < 50
  }, [])

  const virtualItems = rowVirtualizer.getVirtualItems()
  const isInputDisabled = disabled || !!pendingClarification

  return (
    <div className="flex flex-col h-full bg-[var(--color-bg-primary)]" data-testid="chat-panel">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
        <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">Chat</h2>
        {isGenerating && (
          <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
            <LoadingSpinner size="sm" />
            <span>{generationStage ?? 'Generating...'}</span>
          </div>
        )}
      </div>

      {/* Generation progress */}
      {isGenerating && generationProgress > 0 && (
        <div className="px-4 py-1">
          <ProgressBar value={generationProgress} />
        </div>
      )}

      {/* Message list */}
      <div
        ref={parentRef}
        className="flex-1 overflow-y-auto px-2 py-2"
        onScroll={handleScroll}
        data-testid="message-list"
      >
        {messages.length === 0 ? (
          <EmptyState
            title="Start a conversation"
            description="Paste an API spec URL, upload a file, or describe what you'd like to build."
          />
        ) : (
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {virtualItems.map((virtualRow) => {
              const message = messages[virtualRow.index]
              return (
                <div
                  key={virtualRow.key}
                  data-index={virtualRow.index}
                  ref={rowVirtualizer.measureElement}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <ChatMessage message={message} />
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Clarification panel */}
      {pendingClarification && (
        <div
          className="px-4 py-3 border-t border-[var(--color-border)] bg-[var(--color-bg-secondary)]"
          data-testid="clarification-panel"
        >
          <p className="text-sm font-medium text-[var(--color-text-primary)] mb-2">
            {pendingClarification.question}
          </p>
          <div className="flex flex-wrap gap-2">
            {pendingClarification.options.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => pendingClarification.onSelect(option)}
                className="px-3 py-1.5 text-sm rounded-lg border border-[var(--color-accent)] text-[var(--color-accent)] hover:bg-[var(--color-accent-muted)] transition-colors"
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <ChatInput
        onSend={onSendMessage}
        disabled={isInputDisabled}
        isLoading={isGenerating}
        queueDepth={queueDepth}
      />
    </div>
  )
}
