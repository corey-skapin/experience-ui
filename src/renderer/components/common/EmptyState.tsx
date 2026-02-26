/**
 * EmptyState — placeholder displayed when a section has no content yet.
 */
import type { ReactElement, ReactNode } from 'react'
import { Button } from './Button'
import type { ButtonProps } from './Button'

export interface EmptyStateAction extends Pick<ButtonProps, 'onClick' | 'variant' | 'disabled'> {
  label: string
}

export interface EmptyStateProps {
  /** Icon or illustration to display above the message. */
  icon?: ReactNode
  title: string
  description?: string
  action?: EmptyStateAction
  className?: string
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className = '',
}: EmptyStateProps): ReactElement {
  return (
    <div
      className={['flex flex-col items-center justify-center gap-3 p-10 text-center', className]
        .filter(Boolean)
        .join(' ')}
    >
      {icon && (
        <span className="text-[var(--color-text-disabled)] text-4xl" aria-hidden="true">
          {icon}
        </span>
      )}
      <p className="text-sm font-semibold text-[var(--color-text-primary)]">{title}</p>
      {description && (
        <p className="text-xs text-[var(--color-text-secondary)] max-w-xs">{description}</p>
      )}
      {action && (
        <Button
          size="sm"
          variant={action.variant ?? 'secondary'}
          onClick={action.onClick}
          disabled={action.disabled}
          className="mt-1"
        >
          {action.label}
        </Button>
      )}
    </div>
  )
}
