/**
 * StatusBadge — colored label indicating a status or category.
 */
import type { ReactElement, ReactNode } from 'react'

export type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral'
export type BadgeSize = 'sm' | 'md'

const variantStyles: Record<BadgeVariant, string> = {
  success:
    'bg-[color-mix(in_srgb,var(--color-success)_15%,transparent)] text-[var(--color-success)]',
  warning:
    'bg-[color-mix(in_srgb,var(--color-warning)_15%,transparent)] text-[var(--color-warning)]',
  error: 'bg-[color-mix(in_srgb,var(--color-error)_15%,transparent)] text-[var(--color-error)]',
  info: 'bg-[color-mix(in_srgb,var(--color-info)_15%,transparent)] text-[var(--color-info)]',
  neutral: 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)]',
}

const sizeStyles: Record<BadgeSize, string> = {
  sm: 'px-1.5 py-0.5 text-xs',
  md: 'px-2 py-0.5 text-sm',
}

export interface StatusBadgeProps {
  variant?: BadgeVariant
  size?: BadgeSize
  children: ReactNode
  className?: string
}

export function StatusBadge({
  variant = 'neutral',
  size = 'sm',
  children,
  className = '',
}: StatusBadgeProps): ReactElement {
  return (
    <span
      className={[
        'inline-flex items-center gap-1 font-medium rounded-[var(--radius-full)]',
        variantStyles[variant],
        sizeStyles[size],
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </span>
  )
}
