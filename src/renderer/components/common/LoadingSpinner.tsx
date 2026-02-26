/**
 * LoadingSpinner — animated circular spinner for loading states.
 */
import type { ReactElement } from 'react'

export type SpinnerSize = 'xs' | 'sm' | 'md' | 'lg'

const sizeMap: Record<SpinnerSize, string> = {
  xs: 'h-3 w-3 border',
  sm: 'h-4 w-4 border-2',
  md: 'h-6 w-6 border-2',
  lg: 'h-8 w-8 border-[3px]',
}

export interface LoadingSpinnerProps {
  size?: SpinnerSize
  className?: string
  label?: string
}

export function LoadingSpinner({
  size = 'md',
  className = '',
  label = 'Loading…',
}: LoadingSpinnerProps): ReactElement {
  return (
    <span
      role="status"
      aria-label={label}
      className={[
        'inline-block rounded-full animate-spin',
        'border-current border-t-transparent opacity-75',
        sizeMap[size],
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    />
  )
}
