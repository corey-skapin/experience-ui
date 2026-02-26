// src/renderer/components/versions/VersionTimeline.tsx
// T072 — Chronological version history timeline.
// Renders versions newest-first with rollback and load actions.

import type { JSX } from 'react';

import type { VersionEntry } from '../../services/version-manager/version-manager';

// ─── Types ────────────────────────────────────────────────────────────────────

interface VersionTimelineProps {
  versions: VersionEntry[];
  currentVersionId: string | null;
  onRollback: (id: string) => void;
  onLoad: (id: string) => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const CHANGE_TYPE_ICON: Record<string, string> = {
  generation: '⚡',
  customization: '✏️',
  rollback: '↩️',
};

function formatTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

// ─── Sub-component ────────────────────────────────────────────────────────────

interface VersionRowProps {
  entry: VersionEntry;
  isCurrent: boolean;
  onRollback: (id: string) => void;
  onLoad: (id: string) => void;
}

function VersionRow({ entry, isCurrent, onRollback, onLoad }: VersionRowProps): JSX.Element {
  const icon = CHANGE_TYPE_ICON[entry.changeType] ?? '📌';

  return (
    <div
      role="listitem"
      aria-current={isCurrent ? 'true' : undefined}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 'var(--spacing-2)',
        padding: 'var(--spacing-2) var(--spacing-3)',
        borderBottom: '1px solid var(--color-border-subtle)',
        background: isCurrent ? 'var(--color-surface-raised)' : 'transparent',
      }}
    >
      {/* Icon + version number */}
      <span style={{ fontSize: 'var(--text-sm)', flexShrink: 0 }} aria-hidden="true">
        {icon}
      </span>

      {/* Details */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--spacing-1)',
            marginBottom: 2,
          }}
        >
          <span
            style={{
              fontSize: 'var(--text-xs)',
              fontWeight: 600,
              color: 'var(--color-text-primary)',
            }}
          >
            v{entry.versionNumber}
          </span>
          <span
            style={{
              fontSize: 'var(--text-xs)',
              padding: '1px 6px',
              borderRadius: 'var(--radius-full)',
              background: 'var(--color-surface-raised)',
              border: '1px solid var(--color-border-default)',
              color: 'var(--color-text-secondary)',
            }}
          >
            {entry.changeType}
          </span>
          {isCurrent && (
            <span
              style={{
                fontSize: 'var(--text-xs)',
                color: 'var(--color-accent-primary)',
                fontWeight: 600,
              }}
            >
              current
            </span>
          )}
        </div>

        <p
          style={{
            margin: 0,
            fontSize: 'var(--text-xs)',
            color: 'var(--color-text-secondary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={entry.description}
        >
          {entry.description}
        </p>

        <span
          style={{
            fontSize: 'var(--text-xs)',
            color: 'var(--color-text-tertiary)',
          }}
        >
          {formatTimestamp(entry.createdAt)}
        </span>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 'var(--spacing-1)', flexShrink: 0 }}>
        <button
          type="button"
          aria-label={`Load version ${entry.versionNumber}`}
          onClick={() => onLoad(entry.id)}
          style={{
            padding: '2px var(--spacing-2)',
            fontSize: 'var(--text-xs)',
            background: 'none',
            border: '1px solid var(--color-border-default)',
            borderRadius: 'var(--radius-sm)',
            cursor: 'pointer',
            color: 'var(--color-text-secondary)',
          }}
        >
          Load
        </button>
        <button
          type="button"
          aria-label={`Roll back to version ${entry.versionNumber}`}
          disabled={isCurrent}
          onClick={() => onRollback(entry.id)}
          style={{
            padding: '2px var(--spacing-2)',
            fontSize: 'var(--text-xs)',
            background: 'none',
            border: `1px solid ${isCurrent ? 'var(--color-border-subtle)' : 'var(--color-accent-primary)'}`,
            borderRadius: 'var(--radius-sm)',
            cursor: isCurrent ? 'not-allowed' : 'pointer',
            color: isCurrent ? 'var(--color-text-tertiary)' : 'var(--color-accent-primary)',
            opacity: isCurrent ? 0.5 : 1,
          }}
        >
          Roll back
        </button>
      </div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function VersionTimeline({
  versions,
  currentVersionId,
  onRollback,
  onLoad,
}: VersionTimelineProps): JSX.Element {
  if (versions.length === 0) {
    return (
      <div
        style={{
          padding: 'var(--spacing-4)',
          textAlign: 'center',
          color: 'var(--color-text-tertiary)',
          fontSize: 'var(--text-sm)',
        }}
      >
        No versions yet
      </div>
    );
  }

  return (
    <div role="list" aria-label="Version history" style={{ overflowY: 'auto', maxHeight: '100%' }}>
      {versions.map((entry) => (
        <VersionRow
          key={entry.id}
          entry={entry}
          isCurrent={entry.id === currentVersionId}
          onRollback={onRollback}
          onLoad={onLoad}
        />
      ))}
    </div>
  );
}
