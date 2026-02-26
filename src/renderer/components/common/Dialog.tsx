/**
 * Dialog — accessible modal dialog built on Radix UI Dialog.
 * This is the low-level primitive; use Modal for a higher-level abstraction.
 */
import * as RadixDialog from '@radix-ui/react-dialog'
import type { ReactElement, ReactNode } from 'react'

export interface DialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: ReactNode
}

export interface DialogContentProps {
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
  className?: string
  /** Width of the dialog panel. */
  width?: string
}

/** Root dialog context provider. */
export function Dialog({ open, onOpenChange, children }: DialogProps): ReactElement {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      {children}
    </RadixDialog.Root>
  )
}

/** Trigger element that opens the dialog when interacted with. */
export function DialogTrigger({ children }: { children: ReactNode }): ReactElement {
  return <RadixDialog.Trigger asChild>{children}</RadixDialog.Trigger>
}

/** The dialog panel with overlay, title, and content. */
export function DialogContent({
  title,
  description,
  children,
  footer,
  className = '',
  width = '480px',
}: DialogContentProps): ReactElement {
  return (
    <RadixDialog.Portal>
      {/* Overlay */}
      <RadixDialog.Overlay className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm animate-in fade-in-0" />

      {/* Panel */}
      <RadixDialog.Content
        style={{ maxWidth: width }}
        className={[
          'fixed left-1/2 top-1/2 z-50 w-[90vw] -translate-x-1/2 -translate-y-1/2',
          'rounded-[var(--radius-lg)] bg-[var(--color-bg-primary)]',
          'border border-[var(--color-border)] shadow-[var(--shadow-md)]',
          'flex flex-col gap-4 p-6',
          'animate-in fade-in-0 zoom-in-95',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <RadixDialog.Title className="text-base font-semibold text-[var(--color-text-primary)]">
              {title}
            </RadixDialog.Title>
            {description && (
              <RadixDialog.Description className="text-sm text-[var(--color-text-secondary)]">
                {description}
              </RadixDialog.Description>
            )}
          </div>
          <RadixDialog.Close
            aria-label="Close dialog"
            className={[
              'shrink-0 rounded-[var(--radius-sm)] p-1',
              'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]',
              'hover:bg-[var(--color-bg-tertiary)] transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path
                d="M12 4L4 12M4 4l8 8"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </RadixDialog.Close>
        </div>

        {/* Body */}
        <div className="text-sm text-[var(--color-text-primary)]">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--color-border)]">
            {footer}
          </div>
        )}
      </RadixDialog.Content>
    </RadixDialog.Portal>
  )
}
