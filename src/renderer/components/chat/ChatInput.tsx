/**
 * ChatInput component.
 * Text input with submit, file upload (.json, .yaml, .yml, .graphql),
 * URL paste detection, drag-and-drop, and keyboard shortcuts.
 * Enter to send, Shift+Enter for newline.
 */
import {
  useState,
  useRef,
  useCallback,
  type ReactElement,
  type DragEvent,
  type ChangeEvent,
  type KeyboardEvent,
} from 'react'

// ─── Types ────────────────────────────────────────────────────────────────

interface UploadedFile {
  name: string
  content: string
  mimeType: string
}

interface ChatInputProps {
  onSend: (content: string, file?: UploadedFile) => void
  disabled?: boolean
  placeholder?: string
  isLoading?: boolean
  queueDepth?: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────

const ACCEPTED_TYPES = '.json,.yaml,.yml,.graphql'
const URL_PATTERN = /^https?:\/\//

function isUrl(text: string): boolean {
  return URL_PATTERN.test(text.trim())
}

async function readFileAsText(file: File): Promise<UploadedFile> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      resolve({
        name: file.name,
        content: (e.target?.result as string) ?? '',
        mimeType: file.type || 'text/plain',
      })
    }
    reader.onerror = reject
    reader.readAsText(file)
  })
}

// ─── Component ────────────────────────────────────────────────────────────

export function ChatInput({
  onSend,
  disabled = false,
  placeholder = 'Paste a URL, upload a spec, or describe what you want...',
  isLoading = false,
  queueDepth = 0,
}: ChatInputProps): ReactElement {
  const [text, setText] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const [pendingFile, setPendingFile] = useState<UploadedFile | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleSubmit = useCallback(() => {
    const trimmed = text.trim()
    if (!trimmed && !pendingFile) return
    onSend(trimmed || (pendingFile?.name ?? ''), pendingFile ?? undefined)
    setText('')
    setPendingFile(null)
  }, [text, pendingFile, onSend])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSubmit()
      }
    },
    [handleSubmit],
  )

  const handleFileChange = useCallback(async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const uploaded = await readFileAsText(file)
    setPendingFile(uploaded)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [])

  const handleDrop = useCallback(async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (!file) return
    const uploaded = await readFileAsText(file)
    setPendingFile(uploaded)
  }, [])

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setIsDragging(false)
  }, [])

  const handlePaste = useCallback(async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const pastedText = e.clipboardData.getData('text')
    if (isUrl(pastedText)) {
      // Let it paste normally — URL detection is shown in UI
    }
    // File paste
    const file = e.clipboardData.files[0]
    if (file) {
      e.preventDefault()
      const uploaded = await readFileAsText(file)
      setPendingFile(uploaded)
    }
  }, [])

  const isDisabled = disabled || isLoading
  const urlDetected = isUrl(text)

  return (
    <div
      className={`flex flex-col gap-2 p-3 border-t border-[var(--color-border)] ${isDragging ? 'bg-[var(--color-accent-muted)]' : ''}`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      data-testid="chat-input"
    >
      {/* Queue indicator */}
      {queueDepth > 0 && (
        <div className="text-xs text-[var(--color-text-muted)] px-1">
          {queueDepth} request{queueDepth > 1 ? 's' : ''} queued
        </div>
      )}

      {/* Pending file badge */}
      {pendingFile && (
        <div className="flex items-center gap-2 px-2 py-1 rounded bg-[var(--color-bg-tertiary)] text-sm">
          <span>📎 {pendingFile.name}</span>
          <button
            type="button"
            onClick={() => setPendingFile(null)}
            className="ml-auto text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
            aria-label="Remove file"
          >
            ×
          </button>
        </div>
      )}

      {/* URL detected badge */}
      {urlDetected && (
        <div className="text-xs text-[var(--color-accent)] px-1">
          🔗 URL detected — will fetch spec from this URL
        </div>
      )}

      {/* Drag overlay */}
      {isDragging && (
        <div className="absolute inset-0 flex items-center justify-center bg-[var(--color-accent-muted)] rounded-lg border-2 border-dashed border-[var(--color-accent)] z-10 pointer-events-none">
          <span className="text-[var(--color-accent)] font-medium">Drop spec file here</span>
        </div>
      )}

      <div className="flex items-end gap-2">
        {/* File upload button */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isDisabled}
          className="flex-shrink-0 p-2 rounded-lg text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] disabled:opacity-40"
          aria-label="Upload spec file"
        >
          📎
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_TYPES}
          onChange={handleFileChange}
          className="hidden"
          aria-hidden="true"
        />

        {/* Text input */}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          disabled={isDisabled}
          placeholder={isLoading ? 'Generating...' : placeholder}
          rows={1}
          className="flex-1 resize-none rounded-lg px-3 py-2 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] disabled:opacity-40 min-h-[40px] max-h-[120px]"
          style={{ height: 'auto' }}
          aria-label="Message input"
        />

        {/* Send button */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isDisabled || (!text.trim() && !pendingFile)}
          className="flex-shrink-0 p-2 rounded-lg bg-[var(--color-accent)] text-[var(--color-accent-text)] hover:bg-[var(--color-accent-hover)] disabled:opacity-40"
          aria-label="Send message"
        >
          {isLoading ? '⏳' : '↑'}
        </button>
      </div>
    </div>
  )
}
