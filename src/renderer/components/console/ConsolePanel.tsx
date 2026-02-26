// src/renderer/components/console/ConsolePanel.tsx
// T088 — Collapsible debug console panel with virtual scroll and filtering.

import { type JSX, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

import type { ConsoleEntry } from '../../../shared/types';
import { useConsoleFilter } from './use-console-filter';
import { ConsoleEntryItem } from './ConsoleEntryItem';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface ConsolePanelProps {
  entries: ConsoleEntry[];
  onClear: () => void;
  isVisible: boolean;
}

// ─── Status filter options ────────────────────────────────────────────────────

const STATUS_OPTIONS = ['all', '2xx', '3xx', '4xx', '5xx'] as const;

// ─── Component ───────────────────────────────────────────────────────────────

export function ConsolePanel({ entries, onClear, isVisible }: ConsolePanelProps): JSX.Element | null {  const {
    statusFilter,
    urlFilter,
    keywordFilter,
    setStatusFilter,
    setUrlFilter,
    setKeywordFilter,
    filteredEntries,
    clearFilters,
  } = useConsoleFilter(entries);

  const scrollRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: filteredEntries.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 32,
    overscan: 10,
  });

  if (!isVisible) return null;

  return (
    <div
      role="region"
      aria-label="Debug console"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: 220,
        borderTop: '1px solid var(--color-border-default)',
        background: 'var(--color-surface-sunken)',
        flexShrink: 0,
      }}
    >
      {/* Toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '4px 8px',
          borderBottom: '1px solid var(--color-border-subtle)',
          flexShrink: 0,
          flexWrap: 'wrap',
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: 'var(--color-text-secondary)',
            minWidth: 80,
          }}
        >
          {filteredEntries.length} requests
        </span>

        {/* Status filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="Filter by status code"
          style={{
            fontSize: 11,
            padding: '2px 4px',
            background: 'var(--color-surface-overlay)',
            border: '1px solid var(--color-border-default)',
            borderRadius: 4,
            color: 'var(--color-text-primary)',
          }}
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>
              {opt === 'all' ? 'All' : opt}
            </option>
          ))}
        </select>

        {/* URL filter */}
        <input
          type="text"
          value={urlFilter}
          onChange={(e) => setUrlFilter(e.target.value)}
          placeholder="Filter URL…"
          aria-label="Filter by URL"
          style={{
            fontSize: 11,
            padding: '2px 6px',
            background: 'var(--color-surface-overlay)',
            border: '1px solid var(--color-border-default)',
            borderRadius: 4,
            color: 'var(--color-text-primary)',
            flex: '1',
            minWidth: 80,
          }}
        />

        {/* Keyword search */}
        <input
          type="text"
          value={keywordFilter}
          onChange={(e) => setKeywordFilter(e.target.value)}
          placeholder="Search…"
          aria-label="Keyword search"
          style={{
            fontSize: 11,
            padding: '2px 6px',
            background: 'var(--color-surface-overlay)',
            border: '1px solid var(--color-border-default)',
            borderRadius: 4,
            color: 'var(--color-text-primary)',
            flex: '1',
            minWidth: 80,
          }}
        />

        <button
          type="button"
          onClick={clearFilters}
          style={{
            fontSize: 11,
            padding: '2px 8px',
            background: 'none',
            border: '1px solid var(--color-border-default)',
            borderRadius: 4,
            cursor: 'pointer',
            color: 'var(--color-text-secondary)',
          }}
        >
          Reset
        </button>

        <button
          type="button"
          onClick={onClear}
          style={{
            fontSize: 11,
            padding: '2px 8px',
            background: 'none',
            border: '1px solid var(--color-border-default)',
            borderRadius: 4,
            cursor: 'pointer',
            color: 'var(--color-text-secondary)',
          }}
        >
          Clear
        </button>
      </div>

      {/* Virtual scroll list */}
      <div
        ref={scrollRef}
        style={{ flex: 1, overflow: 'auto' }}
        aria-label="Console entries"
      >
        {filteredEntries.length === 0 ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: 'var(--color-text-tertiary)',
              fontSize: 12,
            }}
          >
            No requests recorded
          </div>
        ) : (
          <div
            style={{
              height: rowVirtualizer.getTotalSize(),
              width: '100%',
              position: 'relative',
            }}
          >
            {rowVirtualizer.getVirtualItems().map((vItem) => {
              const entry = filteredEntries[vItem.index];
              return (
                <div
                  key={vItem.key}
                  style={{
                    position: 'absolute',
                    top: vItem.start,
                    left: 0,
                    width: '100%',
                  }}
                >
                  <ConsoleEntryItem entry={entry} />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
