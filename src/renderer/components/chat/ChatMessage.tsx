/**
 * ChatMessage component.
 * Renders a single chat message by role (user, assistant, system).
 * Displays timestamp, status indicator, and attachments.
 */
import type { ReactElement } from 'react'
import type { ChatMessage as ChatMessageType } from '../../../shared/types'

// ─── Props ────────────────────────────────────────────────────────────────

interface ChatMessageProps {
  message: ChatMessageType
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

const STATUS_LABEL: Record<ChatMessageType['status'], string> = {
  sent: '',
  pending: '⏳',
  queued: '🕐',
  error: '⚠️',
}

const ROLE_STYLES: Record<ChatMessageType['role'], string> = {
  user: 'ml-auto bg-[var(--color-accent)] text-[var(--color-accent-text)] rounded-tl-2xl rounded-bl-2xl rounded-tr-sm',
  assistant:
    'mr-auto bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] rounded-tr-2xl rounded-br-2xl rounded-tl-sm',
  system:
    'mx-auto bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] text-sm italic rounded-xl',
}

// ─── Component ────────────────────────────────────────────────────────────

export function ChatMessage({ message }: ChatMessageProps): ReactElement {
  const { role, content, timestamp, status, attachments } = message

  return (
    <div
      className={`flex flex-col max-w-[80%] px-3 py-2 mb-2 ${role === 'user' ? 'items-end self-end' : role === 'system' ? 'items-center self-center' : 'items-start self-start'}`}
      data-testid="chat-message"
      data-role={role}
    >
      <div className={`px-4 py-2 rounded-2xl break-words ${ROLE_STYLES[role]}`}>{content}</div>

      {/* Attachments */}
      {attachments && attachments.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {attachments.map((attachment, i) => (
            <span
              key={i}
              className="text-xs px-2 py-0.5 rounded-full bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] border border-[var(--color-border)]"
            >
              📎 {attachment.name}
            </span>
          ))}
        </div>
      )}

      {/* Footer: timestamp + status */}
      <div className="flex items-center gap-1 mt-0.5 text-xs text-[var(--color-text-muted)]">
        <span>{formatTimestamp(timestamp)}</span>
        {STATUS_LABEL[status] && (
          <span aria-label={`Status: ${status}`}>{STATUS_LABEL[status]}</span>
        )}
      </div>
    </div>
  )
}
