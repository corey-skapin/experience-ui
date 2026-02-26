/**
 * ConnectionStatus — displays connection state with badge, response time, and action buttons.
 */
import { useState, type ReactElement } from 'react'
import { Button } from '../common/Button'
import { StatusBadge, type BadgeVariant } from '../common/StatusBadge'
import { useAuth } from '../../hooks/use-auth'
import type { ConnectionStatus as ConnectionStatusType } from '../../../shared/types'

// ─── Props ─────────────────────────────────────────────────────────────────

export interface ConnectionStatusProps {
  baseUrl: string
  onReauthenticate?: () => void
  className?: string
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function statusToVariant(status: ConnectionStatusType): BadgeVariant {
  switch (status) {
    case 'connected':
      return 'success'
    case 'degraded':
      return 'warning'
    case 'expired':
    case 'unreachable':
      return 'error'
    case 'connecting':
      return 'info'
    default:
      return 'neutral'
  }
}

function statusLabel(status: ConnectionStatusType): string {
  switch (status) {
    case 'connected':
      return 'Connected'
    case 'connecting':
      return 'Connecting…'
    case 'degraded':
      return 'Degraded'
    case 'expired':
      return 'Session Expired'
    case 'unreachable':
      return 'Unreachable'
    default:
      return 'Disconnected'
  }
}

// ─── Component ─────────────────────────────────────────────────────────────

export function ConnectionStatus({
  baseUrl,
  onReauthenticate,
  className = '',
}: ConnectionStatusProps): ReactElement {
  const [responseTimeMs, setResponseTimeMs] = useState<number | null>(null)
  const { status, isLoading, testConnection } = useAuth(baseUrl)

  const handleTestConnection = async () => {
    const result = await testConnection(baseUrl)
    setResponseTimeMs(result.responseTimeMs)
  }

  return (
    <div className={`flex items-center gap-3 ${className}`} data-testid="connection-status">
      <StatusBadge variant={statusToVariant(status)} data-testid="status-badge">
        {statusLabel(status)}
      </StatusBadge>

      {responseTimeMs !== null && (
        <span className="text-xs text-[var(--color-text-muted)]" data-testid="response-time">
          {responseTimeMs}ms
        </span>
      )}

      {status === 'expired' && onReauthenticate && (
        <Button variant="danger" size="sm" onClick={onReauthenticate} data-testid="reauth-button">
          Re-authenticate
        </Button>
      )}

      <Button
        variant="ghost"
        size="sm"
        onClick={handleTestConnection}
        disabled={isLoading}
        loading={isLoading}
        data-testid="test-connection-button"
      >
        Test Connection
      </Button>
    </div>
  )
}
