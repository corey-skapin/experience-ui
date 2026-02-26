import React from 'react';
import type { ChatMessage as ChatMessageType } from '../../../shared/types';

interface ChatMessageProps {
  message: ChatMessageType;
}

const ROLE_STYLES: Record<ChatMessageType['role'], string> = {
  user: 'ml-auto bg-[var(--color-accent)] text-white max-w-[80%]',
  assistant: 'mr-auto bg-[var(--color-bg-secondary)] max-w-[80%]',
  system:
    'mx-auto bg-[var(--color-bg-tertiary,#f0f0f0)] text-[var(--color-text-secondary)] text-sm max-w-full italic',
};

const STATUS_ICONS: Record<ChatMessageType['status'], string> = {
  sent: '✓',
  pending: '⏳',
  queued: '⏸',
  error: '✗',
};

export function ChatMessage({ message }: ChatMessageProps): React.JSX.Element {
  const timestamp = new Date(message.timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div
      className={`mb-3 flex flex-col rounded-lg px-3 py-2 ${ROLE_STYLES[message.role]}`}
      data-testid={`chat-message-${message.id}`}
    >
      <p className="whitespace-pre-wrap break-words text-sm">{message.content}</p>

      {message.attachments && message.attachments.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {message.attachments.map((att, i) => (
            <span
              key={i}
              className="rounded bg-black/10 px-1.5 py-0.5 text-xs"
              title={att.mimeType}
            >
              📎 {att.name}
            </span>
          ))}
        </div>
      )}

      <div className="mt-1 flex items-center gap-1 text-[10px] opacity-60">
        <span>{timestamp}</span>
        {message.role === 'user' && (
          <span aria-label={`Status: ${message.status}`} title={message.status}>
            {STATUS_ICONS[message.status]}
          </span>
        )}
      </div>
    </div>
  );
}
