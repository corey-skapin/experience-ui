/**
 * Tooltip — contextual hover label using Radix UI Tooltip.
 */
import * as RadixTooltip from '@radix-ui/react-tooltip'
import type { ReactElement, ReactNode } from 'react'

export interface TooltipProps {
  content: ReactNode
  children: ReactNode
  side?: 'top' | 'right' | 'bottom' | 'left'
  align?: 'start' | 'center' | 'end'
  delayDuration?: number
  /** Skip tooltip rendering (useful for conditionally disabling). */
  disabled?: boolean
}

export function Tooltip({
  content,
  children,
  side = 'top',
  align = 'center',
  delayDuration = 600,
  disabled = false,
}: TooltipProps): ReactElement {
  if (disabled) {
    return <>{children}</>
  }

  return (
    <RadixTooltip.Provider delayDuration={delayDuration}>
      <RadixTooltip.Root>
        <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
        <RadixTooltip.Portal>
          <RadixTooltip.Content
            side={side}
            align={align}
            sideOffset={6}
            className={[
              'z-50 max-w-xs px-2.5 py-1.5 rounded-[var(--radius-md)]',
              'bg-[var(--color-text-primary)] text-[var(--color-bg-primary)]',
              'text-xs font-medium shadow-[var(--shadow-md)]',
              'animate-in fade-in-0 zoom-in-95',
              'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {content}
            <RadixTooltip.Arrow className="fill-[var(--color-text-primary)]" />
          </RadixTooltip.Content>
        </RadixTooltip.Portal>
      </RadixTooltip.Root>
    </RadixTooltip.Provider>
  )
}
