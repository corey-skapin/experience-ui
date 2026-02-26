// src/renderer/components/chat/ChatMessage.tsx
// Chat message bubble: role-based alignment, status indicators, and attachment pills.

import { type JSX } from 'react';

import type { ChatMessage as ChatMessageData } from '../../../shared/types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChatMessageProps {
  message: ChatMessageData;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns a human-readable relative time string for an ISO 8601 timestamp.
 * Granularity: seconds → minutes → hours → days.
 */
function formatRelativeTime(isoString: string): string {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 30) return 'just now';
  if (diffSec < 60) return `${diffSec}s ago`;

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;

  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;

  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusIndicator({ status }: { status: ChatMessageData['status'] }): JSX.Element | null {
  if (status === 'sent') return null;

  if (status === 'pending') {
    return (
      <span
        role="status"
        aria-label="Sending"
        style={{
          fontSize: 'var(--text-xs)',
          color: 'var(--color-text-tertiary)',
          animation: 'pulse 1.5s infinite',
        }}
      >
        ●
      </span>
    );
  }

  if (status === 'queued') {
    return (
      <span
        role="status"
        aria-label="Queued"
        style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}
      >
        ◷
      </span>
    );
  }

  // status === 'error'
  return (
    <span
      role="alert"
      aria-label="Failed to send"
      style={{ fontSize: 'var(--text-xs)', color: 'var(--color-status-error)' }}
    >
      Failed to send
    </span>
  );
}

function AttachmentPills({
  attachments,
}: {
  attachments: NonNullable<ChatMessageData['attachments']>;
}): JSX.Element {
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 'var(--spacing-1)',
        marginTop: 'var(--spacing-2)',
      }}
    >
      {attachments.map((attachment) => (
        <span
          key={attachment.name}
          title={attachment.name}
          style={{
            padding: '2px var(--spacing-2)',
            background: 'rgba(0, 0, 0, 0.15)',
            border: '1px solid var(--color-border-default)',
            borderRadius: 'var(--radius-full)',
            fontSize: 'var(--text-xs)',
            color: 'inherit',
            maxWidth: '160px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          📎 {attachment.name}
        </span>
      ))}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ChatMessage({ message }: ChatMessageProps): JSX.Element {
  const isUser = message.role === 'user';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: isUser ? 'flex-end' : 'flex-start',
        padding: 'var(--spacing-2) var(--spacing-4)',
        gap: 'var(--spacing-1)',
      }}
    >
      {/* Role label for system messages */}
      {message.role === 'system' && (
        <span
          style={{
            fontSize: 'var(--text-xs)',
            color: 'var(--color-text-tertiary)',
            fontWeight: 'var(--font-medium)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          System
        </span>
      )}

      {/* Bubble */}
      <div
        style={{
          maxWidth: '75%',
          padding: 'var(--spacing-2) var(--spacing-3)',
          borderRadius: 'var(--radius-lg)',
          background: isUser ? 'var(--color-accent-primary)' : 'var(--color-surface-raised)',
          color: isUser ? 'var(--color-text-inverse)' : 'var(--color-text-primary)',
          border: isUser ? 'none' : '1px solid var(--color-border-default)',
          boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: 'var(--text-sm)',
            lineHeight: '1.55',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {message.content}
        </p>
        {message.attachments && message.attachments.length > 0 && (
          <AttachmentPills attachments={message.attachments} />
        )}
      </div>

      {/* Footer: timestamp + status */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--spacing-1)',
        }}
      >
        <time
          dateTime={message.timestamp}
          style={{
            fontSize: 'var(--text-xs)',
            color: 'var(--color-text-tertiary)',
          }}
        >
          {formatRelativeTime(message.timestamp)}
        </time>
        <StatusIndicator status={message.status} />
      </div>
    </div>
  );
}
