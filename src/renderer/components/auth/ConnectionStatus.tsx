// src/renderer/components/auth/ConnectionStatus.tsx
// T053 — Color-coded connection status badge with test and re-auth actions.

import { type JSX, useCallback, useState } from 'react';

import { useAuth } from '../../hooks/use-auth';
import type { ConnectionStatus as ConnectionStatusType } from '../../../shared/types';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface ConnectionStatusProps {
  baseUrl: string;
  /** Optional callback when re-authenticate is requested. */
  onReauthenticate?: () => void;
}

// ─── Badge colors ─────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<ConnectionStatusType, { bg: string; text: string; label: string }> = {
  connected: { bg: '#dcfce7', text: '#16a34a', label: 'Connected' },
  degraded: { bg: '#fef9c3', text: '#ca8a04', label: 'Degraded' },
  unreachable: { bg: '#fee2e2', text: '#dc2626', label: 'Unreachable' },
  expired: { bg: '#fed7aa', text: '#ea580c', label: 'Token Expired' },
  disconnected: { bg: '#f1f5f9', text: '#64748b', label: 'Disconnected' },
  connecting: { bg: '#dbeafe', text: '#2563eb', label: 'Connecting…' },
};

// ─── Component ────────────────────────────────────────────────────────────────

export function ConnectionStatus({
  baseUrl,
  onReauthenticate,
}: ConnectionStatusProps): JSX.Element {
  const { getStatus, testConnection, isLoading } = useAuth();
  const [responseTimeMs, setResponseTimeMs] = useState<number | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  const status = getStatus(baseUrl);
  const colors = STATUS_COLORS[status] ?? STATUS_COLORS.disconnected;

  const handleTest = useCallback(async () => {
    setTestError(null);
    const result = await testConnection(baseUrl);
    setResponseTimeMs(result.responseTimeMs);
    if (result.error) setTestError(result.error);
  }, [baseUrl, testConnection]);

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--spacing-2)',
        flexWrap: 'wrap',
      }}
      aria-label={`Connection status for ${baseUrl}`}
    >
      {/* Status badge */}
      <span
        role="status"
        aria-label={`Status: ${colors.label}`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 'var(--spacing-1)',
          padding: '2px 10px',
          borderRadius: 'var(--radius-full, 9999px)',
          background: colors.bg,
          color: colors.text,
          fontSize: 'var(--text-xs)',
          fontWeight: 600,
          whiteSpace: 'nowrap',
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: colors.text,
            display: 'inline-block',
          }}
          aria-hidden="true"
        />
        {colors.label}
        {status === 'connected' && responseTimeMs !== null && (
          <span style={{ fontWeight: 400, marginLeft: 4 }}>({responseTimeMs}ms)</span>
        )}
      </span>

      {/* Test connection button */}
      <button
        type="button"
        onClick={() => void handleTest()}
        disabled={isLoading}
        aria-label="Test connection"
        style={{ fontSize: 'var(--text-xs)', padding: '2px 8px' }}
      >
        {isLoading ? 'Testing…' : 'Test'}
      </button>

      {/* Re-authenticate button — shown when token is expired */}
      {status === 'expired' && (
        <button
          type="button"
          onClick={onReauthenticate}
          aria-label="Re-authenticate"
          style={{ fontSize: 'var(--text-xs)', padding: '2px 8px', color: '#ea580c' }}
        >
          Re-authenticate
        </button>
      )}

      {/* Inline error */}
      {testError && (
        <span
          role="alert"
          style={{ fontSize: 'var(--text-xs)', color: 'var(--color-status-error)' }}
        >
          {testError}
        </span>
      )}
    </div>
  );
}
