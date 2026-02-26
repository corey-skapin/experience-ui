// src/renderer/components/common/StatusBadge.tsx
// StatusBadge, LoadingSpinner, and ProgressBar primitives (T014).
import type { JSX, HTMLAttributes } from 'react';

// ─── Status Badge ─────────────────────────────────────────────────────────────

export type BadgeVariant =
  | 'default'
  | 'success'
  | 'warning'
  | 'error'
  | 'info'
  | 'connected'
  | 'degraded'
  | 'expired'
  | 'unreachable'
  | 'disconnected'
  | 'connecting';

interface StatusBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  dot?: boolean;
}

const badgeVariantClasses: Record<BadgeVariant, string> = {
  default:
    'bg-[--color-surface-raised] text-[--color-text-secondary] ' +
    'border border-[--color-border-default]',
  success:
    'bg-[--color-status-success-bg] text-[--color-status-success] ' +
    'border border-[--color-status-success]',
  warning:
    'bg-[--color-status-warning-bg] text-[--color-status-warning] ' +
    'border border-[--color-status-warning]',
  error:
    'bg-[--color-status-error-bg] text-[--color-status-error] ' +
    'border border-[--color-status-error]',
  info:
    'bg-[--color-status-info-bg] text-[--color-status-info] ' +
    'border border-[--color-status-info]',
  connected:
    'bg-[--color-status-success-bg] text-[--color-connection-connected] ' +
    'border border-[--color-connection-connected]',
  degraded:
    'bg-[--color-status-warning-bg] text-[--color-connection-degraded] ' +
    'border border-[--color-connection-degraded]',
  expired:
    'bg-[--color-status-error-bg] text-[--color-connection-expired] ' +
    'border border-[--color-connection-expired]',
  unreachable:
    'bg-[--color-surface-raised] text-[--color-connection-unreachable] ' +
    'border border-[--color-connection-unreachable]',
  disconnected:
    'bg-[--color-surface-raised] text-[--color-connection-disconnected] ' +
    'border border-[--color-connection-disconnected]',
  connecting:
    'bg-[--color-status-info-bg] text-[--color-connection-connecting] ' +
    'border border-[--color-connection-connecting]',
};

const dotVariantClasses: Record<BadgeVariant, string> = {
  default: 'bg-[--color-text-tertiary]',
  success: 'bg-[--color-status-success]',
  warning: 'bg-[--color-status-warning]',
  error: 'bg-[--color-status-error]',
  info: 'bg-[--color-status-info]',
  connected: 'bg-[--color-connection-connected]',
  degraded: 'bg-[--color-connection-degraded] animate-pulse',
  expired: 'bg-[--color-connection-expired]',
  unreachable: 'bg-[--color-connection-unreachable]',
  disconnected: 'bg-[--color-connection-disconnected]',
  connecting: 'bg-[--color-connection-connecting] animate-pulse',
};

export function StatusBadge({
  variant = 'default',
  dot = true,
  children,
  className = '',
  ...props
}: StatusBadgeProps): JSX.Element {
  return (
    <span
      className={
        `inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[--radius-full] ` +
        `text-xs font-medium ${badgeVariantClasses[variant]} ${className}`
      }
      {...props}
    >
      {dot && (
        <span
          className={`size-1.5 rounded-full shrink-0 ${dotVariantClasses[variant]}`}
          aria-hidden="true"
        />
      )}
      {children}
    </span>
  );
}

// ─── Loading Spinner ──────────────────────────────────────────────────────────

export type SpinnerSize = 'xs' | 'sm' | 'md' | 'lg';

interface LoadingSpinnerProps extends HTMLAttributes<HTMLSpanElement> {
  size?: SpinnerSize;
  label?: string;
}

const spinnerSizeClasses: Record<SpinnerSize, string> = {
  xs: 'size-3',
  sm: 'size-4',
  md: 'size-6',
  lg: 'size-8',
};

export function LoadingSpinner({
  size = 'md',
  label = 'Loading…',
  className = '',
  ...props
}: LoadingSpinnerProps): JSX.Element {
  return (
    <span
      role="status"
      aria-label={label}
      className={`inline-flex items-center justify-center ${className}`}
      {...props}
    >
      <svg
        className={`animate-spin text-[--color-accent-primary] ${spinnerSizeClasses[size]}`}
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
        />
      </svg>
    </span>
  );
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────

import * as ProgressPrimitive from '@radix-ui/react-progress';

interface ProgressBarProps {
  value: number; // 0-100
  max?: number;
  label?: string;
  className?: string;
  showLabel?: boolean;
}

export function ProgressBar({
  value,
  max = 100,
  label,
  className = '',
  showLabel = false,
}: ProgressBarProps): JSX.Element {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));

  return (
    <div className={`w-full ${className}`}>
      {(label ?? showLabel) && (
        <div className="flex items-center justify-between mb-1.5">
          {label && (
            <span className="text-xs text-[--color-text-secondary]">{label}</span>
          )}
          {showLabel && (
            <span className="text-xs text-[--color-text-tertiary]">
              {Math.round(pct)}%
            </span>
          )}
        </div>
      )}
      <ProgressPrimitive.Root
        value={pct}
        max={100}
        aria-label={label ?? 'Progress'}
        className={
          'relative w-full h-1.5 overflow-hidden rounded-[--radius-full] ' +
          'bg-[--color-surface-sunken]'
        }
      >
        <ProgressPrimitive.Indicator
          className="h-full bg-[--color-accent-primary] transition-transform duration-300 ease-in-out"
          style={{ transform: `translateX(-${100 - pct}%)` }}
        />
      </ProgressPrimitive.Root>
    </div>
  );
}
