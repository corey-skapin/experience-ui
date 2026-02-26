// src/renderer/components/chat/ChatInput.tsx
// Chat input with textarea, file attachment, drag-and-drop, and keyboard shortcuts.

import {
  type JSX,
  type KeyboardEvent,
  type ClipboardEvent,
  type ChangeEvent,
  type DragEvent,
  useCallback,
  useRef,
  useState,
} from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChatInputProps {
  onSend: (text: string, attachment?: File) => void;
  disabled?: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ACCEPTED_FILE_TYPES = '.json,.yaml,.yml,.graphql';

// ─── Sub-components ───────────────────────────────────────────────────────────

interface AttachmentBadgeProps {
  file: File;
  onRemove: () => void;
}

function AttachmentBadge({ file, onRemove }: AttachmentBadgeProps): JSX.Element {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--spacing-1)',
        padding: '2px var(--spacing-2)',
        background: 'var(--color-surface-raised)',
        border: '1px solid var(--color-border-default)',
        borderRadius: 'var(--radius-full)',
        fontSize: 'var(--text-xs)',
        color: 'var(--color-text-secondary)',
        maxWidth: '240px',
      }}
    >
      <span
        style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        title={file.name}
      >
        📎 {file.name}
      </span>
      <button
        type="button"
        aria-label={`Remove attachment ${file.name}`}
        onClick={onRemove}
        style={{
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 16,
          height: 16,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--color-text-tertiary)',
          fontSize: 'var(--text-sm)',
          padding: 0,
          lineHeight: 1,
          borderRadius: 'var(--radius-full)',
        }}
      >
        ×
      </button>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ChatInput({ onSend, disabled = false }: ChatInputProps): JSX.Element {
  const [text, setText] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const canSend = !disabled && (text.trim().length > 0 || selectedFile !== null);

  const clearState = useCallback(() => {
    setText('');
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const handleSend = useCallback(() => {
    if (!canSend) return;
    onSend(text.trim(), selectedFile ?? undefined);
    clearState();
  }, [canSend, onSend, text, selectedFile, clearState]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  /**
   * URL paste detection: if the pasted text looks like a spec URL, update the
   * textarea value directly so the full URL appears and is treated as text input.
   * The user can then press Enter to trigger fetch-based ingestion in handleSend.
   */
  const handlePaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const pasted = e.clipboardData.getData('text');
    if (pasted.startsWith('http://') || pasted.startsWith('https://')) {
      // Let default paste happen; App.tsx will detect the URL prefix and fetch.
    }
    // All other pastes are handled by default browser behaviour.
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setSelectedFile(file);
  };

  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingOver(false);
    const file = e.dataTransfer.files?.[0] ?? null;
    if (file) setSelectedFile(file);
  }, []);

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!isDraggingOver) setIsDraggingOver(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    // Only clear if leaving the root container, not a child element.
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
      setIsDraggingOver(false);
    }
  };

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      style={{
        padding: 'var(--spacing-3)',
        borderTop: '1px solid var(--color-border-default)',
        background: isDraggingOver ? 'var(--color-surface-raised)' : 'var(--color-bg-primary)',
        outline: isDraggingOver ? '2px dashed var(--color-accent-primary)' : 'none',
        outlineOffset: '-2px',
        transition: 'background 0.1s ease, outline 0.1s ease',
      }}
      aria-label="Message composer"
    >
      {/* Attachment preview */}
      {selectedFile && (
        <div style={{ marginBottom: 'var(--spacing-2)' }}>
          <AttachmentBadge
            file={selectedFile}
            onRemove={() => {
              setSelectedFile(null);
              if (fileInputRef.current) fileInputRef.current.value = '';
            }}
          />
        </div>
      )}

      <div style={{ display: 'flex', gap: 'var(--spacing-2)', alignItems: 'flex-end' }}>
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_FILE_TYPES}
          onChange={handleFileChange}
          disabled={disabled}
          style={{ display: 'none' }}
          aria-hidden="true"
          tabIndex={-1}
        />

        {/* Attach file button */}
        <button
          type="button"
          aria-label="Attach a spec file (.json, .yaml, .graphql)"
          disabled={disabled}
          onClick={() => fileInputRef.current?.click()}
          style={{
            flexShrink: 0,
            width: 32,
            height: 32,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'none',
            border: '1px solid var(--color-border-default)',
            borderRadius: 'var(--radius-md)',
            cursor: disabled ? 'not-allowed' : 'pointer',
            color: 'var(--color-text-secondary)',
            opacity: disabled ? 0.5 : 1,
            fontSize: 'var(--text-base)',
          }}
        >
          📎
        </button>

        {/* Message textarea */}
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          disabled={disabled}
          placeholder="Type a message or paste a URL… (Enter to send, Shift+Enter for newline)"
          rows={3}
          aria-label="Message input"
          aria-multiline="true"
          style={{
            flex: 1,
            resize: 'none',
            padding: 'var(--spacing-2)',
            background: 'var(--color-bg-primary)',
            border: '1px solid var(--color-border-default)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--color-text-primary)',
            fontSize: 'var(--text-sm)',
            fontFamily: 'var(--font-sans)',
            lineHeight: '1.5',
            outline: 'none',
            cursor: disabled ? 'not-allowed' : 'auto',
            opacity: disabled ? 0.6 : 1,
          }}
        />

        {/* Send button */}
        <button
          type="button"
          aria-label="Send message"
          disabled={!canSend}
          onClick={handleSend}
          style={{
            flexShrink: 0,
            width: 32,
            height: 32,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: canSend ? 'var(--color-accent-primary)' : 'var(--color-surface-raised)',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            cursor: canSend ? 'pointer' : 'not-allowed',
            color: canSend ? 'var(--color-text-inverse)' : 'var(--color-text-tertiary)',
            fontSize: 'var(--text-base)',
            transition: 'background 0.15s ease',
          }}
        >
          ➤
        </button>
      </div>
    </div>
  );
}
