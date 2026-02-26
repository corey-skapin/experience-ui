// src/renderer/components/console/ConsoleEntryItem.tsx
// T089 — Single console entry row with expandable request/response detail.

import { type JSX, useState } from 'react';

import type { ConsoleEntry } from '../../../shared/types';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface ConsoleEntryItemProps {
  entry: ConsoleEntry;
}

// ─── Method badge colours ─────────────────────────────────────────────────────

const METHOD_COLORS: Record<string, string> = {
  GET: '#3b82f6',
  POST: '#22c55e',
  PUT: '#f97316',
  PATCH: '#8b5cf6',
  DELETE: '#ef4444',
  HEAD: '#6b7280',
  OPTIONS: '#6b7280',
};

function methodColor(method: string): string {
  return METHOD_COLORS[method.toUpperCase()] ?? '#6b7280';
}

// ─── Status code colour ───────────────────────────────────────────────────────

function statusColor(code: number): string {
  if (code >= 200 && code < 300) return '#22c55e';
  if (code >= 300 && code < 400) return '#eab308';
  return '#ef4444';
}

// ─── JSON pretty-print helper ─────────────────────────────────────────────────

function prettyJson(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

// ─── Section ─────────────────────────────────────────────────────────────────

function Section({ label, content }: { label: string; content: string }): JSX.Element {
  if (!content) return <></>;
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginBottom: 2 }}>
        {label}
      </div>
      <pre
        style={{
          margin: 0,
          fontSize: 11,
          background: 'var(--color-surface-sunken)',
          padding: '4px 6px',
          borderRadius: 4,
          overflowX: 'auto',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all',
          maxHeight: 200,
          overflowY: 'auto',
        }}
      >
        {content}
      </pre>
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ConsoleEntryItem({ entry }: ConsoleEntryItemProps): JSX.Element {
  const [expanded, setExpanded] = useState(false);
  const { request, response, elapsedMs } = entry;
  const urlShort = request.url.length > 60 ? request.url.slice(0, 60) + '…' : request.url;
  const statusCode = response?.statusCode;

  return (
    <div
      style={{
        borderBottom: '1px solid var(--color-border-subtle)',
        fontSize: 12,
        fontFamily: 'var(--font-mono)',
      }}
    >
      {/* Summary row */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '4px 8px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
          color: 'var(--color-text-primary)',
        }}
        aria-expanded={expanded}
      >
        <span
          style={{
            fontWeight: 700,
            color: methodColor(request.method),
            minWidth: 50,
          }}
        >
          {request.method}
        </span>
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {urlShort}
        </span>
        {statusCode !== undefined && (
          <span style={{ color: statusColor(statusCode), minWidth: 36 }}>{statusCode}</span>
        )}
        {elapsedMs !== null && (
          <span style={{ color: 'var(--color-text-tertiary)', minWidth: 48, textAlign: 'right' }}>
            {elapsedMs}ms
          </span>
        )}
        <span style={{ color: 'var(--color-text-tertiary)' }}>{expanded ? '▲' : '▼'}</span>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div style={{ padding: '0 8px 8px 8px' }}>
          <Section label="Request Headers" content={JSON.stringify(request.headers, null, 2)} />
          {request.body && <Section label="Request Body" content={prettyJson(request.body)} />}
          {response && (
            <>
              <Section label="Response Headers" content={JSON.stringify(response.headers, null, 2)} />
              {response.body && <Section label="Response Body" content={prettyJson(response.body)} />}
            </>
          )}
        </div>
      )}
    </div>
  );
}
