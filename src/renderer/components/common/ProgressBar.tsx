/**
 * ProgressBar — determinate progress indicator using Radix UI Progress.
 */
import * as RadixProgress from '@radix-ui/react-progress'
import type { ReactElement } from 'react'

export interface ProgressBarProps {
  /** Value from 0 to 100. */
  value: number
  /** Accessible label. */
  label?: string
  className?: string
  /** Visual height of the bar track. */
  height?: string
}

export function ProgressBar({
  value,
  label = 'Progress',
  className = '',
  height = '6px',
}: ProgressBarProps): ReactElement {
  const clamped = Math.min(100, Math.max(0, value))

  return (
    <RadixProgress.Root
      value={clamped}
      max={100}
      aria-label={label}
      className={[
        'relative w-full overflow-hidden rounded-[var(--radius-full)]',
        'bg-[var(--color-bg-tertiary)]',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      style={{ height }}
    >
      <RadixProgress.Indicator
        className="h-full bg-[var(--color-accent)] transition-transform duration-300 ease-in-out"
        style={{ transform: `translateX(-${100 - clamped}%)` }}
      />
    </RadixProgress.Root>
  )
}
