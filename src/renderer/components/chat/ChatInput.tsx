import React, { useRef, useState, useCallback } from 'react';

interface ChatInputProps {
  onSubmit: (message: string, file?: File) => void;
  isDisabled?: boolean;
}

const ACCEPTED_FILE_TYPES = '.json,.yaml,.yml,.graphql';

export function ChatInput({ onSubmit, isDisabled = false }: ChatInputProps): React.JSX.Element {
  const [text, setText] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = useCallback(
    (file?: File): void => {
      const trimmed = text.trim();
      if (!trimmed && !file) return;
      onSubmit(trimmed, file);
      setText('');
    },
    [text, onSubmit],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit],
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>): void => {
      const file = e.target.files?.[0];
      if (file) handleSubmit(file);
      e.target.value = '';
    },
    [handleSubmit],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>): void => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleSubmit(file);
    },
    [handleSubmit],
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((): void => setDragOver(false), []);

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLTextAreaElement>): void => {
    const pastedText = e.clipboardData.getData('text');
    if (/^https?:\/\//i.test(pastedText.trim())) {
      // URL detected — will be handled on submit
    }
    void pastedText;
  }, []);

  return (
    <div
      className={`border-t border-[var(--color-border)] p-2 ${dragOver ? 'bg-[var(--color-accent)]/10' : ''}`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      data-testid="chat-input-container"
    >
      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          disabled={isDisabled}
          placeholder="Paste an API spec, URL, or describe what you want…"
          aria-label="Chat message input"
          rows={3}
          className="min-h-[72px] flex-1 resize-none rounded border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)] disabled:opacity-50"
        />

        <div className="flex flex-col gap-1">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isDisabled}
            aria-label="Upload API spec file"
            title="Upload file (.json, .yaml, .yml, .graphql)"
            className="rounded border border-[var(--color-border)] px-2 py-1.5 text-sm hover:bg-[var(--color-bg-secondary)] disabled:opacity-50"
          >
            📎
          </button>

          <button
            type="button"
            onClick={() => handleSubmit()}
            disabled={isDisabled || !text.trim()}
            aria-label="Send message"
            className="rounded bg-[var(--color-accent)] px-3 py-1.5 text-sm text-white hover:opacity-90 disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_FILE_TYPES}
        className="hidden"
        onChange={handleFileChange}
        aria-label="File upload input"
      />
    </div>
  );
}
