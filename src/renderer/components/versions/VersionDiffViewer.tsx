// src/renderer/components/versions/VersionDiffViewer.tsx
// T073 — Diff viewer component.
// Parses JSON-serialised diff lines and renders colour-coded add/delete/unchanged lines.

import type { CSSProperties, JSX } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DiffLine {
  type: 'add' | 'delete' | 'unchanged';
  content: string;
  lineNumber: number;
}

interface VersionDiffViewerProps {
  diff: string;
  isLoading?: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const LINE_STYLES: Record<DiffLine['type'], CSSProperties> = {
  add: {
    background: 'rgba(0,200,83,0.08)',
    color: 'var(--color-status-success, #16a34a)',
    borderLeft: '3px solid var(--color-status-success, #16a34a)',
  },
  delete: {
    background: 'rgba(220,38,38,0.08)',
    color: 'var(--color-status-error, #dc2626)',
    borderLeft: '3px solid var(--color-status-error, #dc2626)',
  },
  unchanged: {
    color: 'var(--color-text-secondary)',
    borderLeft: '3px solid transparent',
  },
};

const LINE_PREFIX: Record<DiffLine['type'], string> = {
  add: '+',
  delete: '-',
  unchanged: ' ',
};

function parseDiffLines(diffStr: string): DiffLine[] {
  try {
    const parsed = JSON.parse(diffStr) as unknown;
    if (Array.isArray(parsed)) return parsed as DiffLine[];
  } catch {
    // Fall through to line-by-line parsing below
  }

  // Fallback: parse as unified diff text
  return diffStr.split('\n').map((line, i) => {
    if (line.startsWith('+')) return { type: 'add', content: line, lineNumber: i + 1 };
    if (line.startsWith('-')) return { type: 'delete', content: line, lineNumber: i + 1 };
    return { type: 'unchanged', content: line, lineNumber: i + 1 };
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

export function VersionDiffViewer({
  diff,
  isLoading = false,
}: VersionDiffViewerProps): JSX.Element {
  if (isLoading) {
    return (
      <div
        style={{
          padding: 'var(--spacing-4)',
          textAlign: 'center',
          color: 'var(--color-text-tertiary)',
          fontSize: 'var(--text-sm)',
        }}
        role="status"
        aria-label="Loading diff"
      >
        Loading diff…
      </div>
    );
  }

  if (!diff) {
    return (
      <div
        style={{
          padding: 'var(--spacing-4)',
          textAlign: 'center',
          color: 'var(--color-text-tertiary)',
          fontSize: 'var(--text-sm)',
        }}
      >
        No diff available
      </div>
    );
  }

  const lines = parseDiffLines(diff);

  return (
    <div
      role="region"
      aria-label="Version diff"
      style={{
        fontFamily: 'var(--font-mono, monospace)',
        fontSize: 'var(--text-xs)',
        overflowX: 'auto',
      }}
    >
      {lines.map((line) => (
        <div
          key={`${line.lineNumber}-${line.type}`}
          style={{
            display: 'flex',
            ...LINE_STYLES[line.type],
            padding: '1px var(--spacing-2)',
          }}
        >
          <span
            style={{ flexShrink: 0, userSelect: 'none', marginRight: 'var(--spacing-2)' }}
            aria-hidden="true"
          >
            {LINE_PREFIX[line.type]}
          </span>
          <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
            {line.content}
          </pre>
        </div>
      ))}
    </div>
  );
}
