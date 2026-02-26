import React from 'react';
import type { ConnectionStatus } from '@shared/types';

export type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral';

export interface StatusBadgeProps {
  status?: ConnectionStatus;
  variant?: BadgeVariant;
  label?: string;
  showDot?: boolean;
}

const statusToVariant: Record<ConnectionStatus, BadgeVariant> = {
  connected: 'success',
  degraded: 'warning',
  unreachable: 'error',
  expired: 'warning',
  disconnected: 'neutral',
  connecting: 'info',
};

const statusLabels: Record<ConnectionStatus, string> = {
  connected: 'Connected',
  degraded: 'Degraded',
  unreachable: 'Unreachable',
  expired: 'Expired',
  disconnected: 'Disconnected',
  connecting: 'Connecting',
};

const variantClasses: Record<BadgeVariant, string> = {
  success: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  warning: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  error: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  info: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  neutral: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
};

const dotColors: Record<BadgeVariant, string> = {
  success: 'bg-green-500',
  warning: 'bg-yellow-500',
  error: 'bg-red-500',
  info: 'bg-blue-500',
  neutral: 'bg-gray-400',
};

export function StatusBadge({
  status,
  variant,
  label,
  showDot = true,
}: StatusBadgeProps): React.JSX.Element {
  const resolvedVariant = variant ?? (status ? statusToVariant[status] : 'neutral');
  const resolvedLabel = label ?? (status ? statusLabels[status] : 'Unknown');

  return (
    <span
      className={[
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium',
        variantClasses[resolvedVariant],
      ].join(' ')}
    >
      {showDot && (
        <span
          className={['w-1.5 h-1.5 rounded-full', dotColors[resolvedVariant]].join(' ')}
          aria-hidden="true"
        />
      )}
      {resolvedLabel}
    </span>
  );
}
