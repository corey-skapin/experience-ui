// src/renderer/components/common/Modal.tsx
// Modal and Dialog primitives (T014).
// Built on @radix-ui/react-dialog for accessibility + Tailwind CSS.
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { type JSX, type ReactNode } from 'react';

// ─── Dialog (low-level Radix wrapper) ────────────────────────────────────────

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

// ─── Dialog Content ───────────────────────────────────────────────────────────

interface DialogContentProps {
  children: ReactNode;
  className?: string;
  /** Hide the default close button */
  hideCloseButton?: boolean;
  'aria-label'?: string;
}

export function DialogContent({
  children,
  className = '',
  hideCloseButton = false,
  'aria-label': ariaLabel,
}: DialogContentProps): JSX.Element {
  return (
    <DialogPrimitive.Portal>
      {/* Overlay */}
      <DialogPrimitive.Overlay
        className={
          'fixed inset-0 z-[--z-overlay] bg-[--color-bg-overlay] ' +
          'data-[state=open]:animate-in data-[state=closed]:animate-out ' +
          'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0'
        }
      />
      {/* Panel */}
      <DialogPrimitive.Content
        aria-label={ariaLabel}
        className={
          'fixed left-1/2 top-1/2 z-[--z-modal] ' +
          '-translate-x-1/2 -translate-y-1/2 ' +
          'w-full max-w-lg ' +
          'bg-[--color-surface-overlay] rounded-[--radius-xl] shadow-[--shadow-xl] ' +
          'border border-[--color-border-default] ' +
          'p-6 ' +
          'data-[state=open]:animate-in data-[state=closed]:animate-out ' +
          'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 ' +
          'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 ' +
          `${className}`
        }
      >
        {children}
        {!hideCloseButton && (
          <DialogPrimitive.Close
            className={
              'absolute right-4 top-4 rounded-[--radius-sm] p-1 ' +
              'text-[--color-text-tertiary] hover:text-[--color-text-primary] ' +
              'hover:bg-[--color-surface-raised] ' +
              'transition-colors duration-[--duration-fast] ' +
              'focus-visible:outline-2 focus-visible:outline-[--color-border-focus]'
            }
            aria-label="Close dialog"
          >
            <X size={16} aria-hidden="true" />
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

// ─── Dialog Header ────────────────────────────────────────────────────────────

export function DialogHeader({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}): JSX.Element {
  return (
    <div className={`mb-4 ${className}`}>
      {children}
    </div>
  );
}

// ─── Dialog Title ─────────────────────────────────────────────────────────────

export function DialogTitle({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}): JSX.Element {
  return (
    <DialogPrimitive.Title
      className={
        `text-lg font-semibold text-[--color-text-primary] ${className}`
      }
    >
      {children}
    </DialogPrimitive.Title>
  );
}

// ─── Dialog Description ───────────────────────────────────────────────────────

export function DialogDescription({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}): JSX.Element {
  return (
    <DialogPrimitive.Description
      className={`text-sm text-[--color-text-secondary] mt-1 ${className}`}
    >
      {children}
    </DialogPrimitive.Description>
  );
}

// ─── Dialog Footer ────────────────────────────────────────────────────────────

export function DialogFooter({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}): JSX.Element {
  return (
    <div className={`mt-6 flex items-center justify-end gap-2 ${className}`}>
      {children}
    </div>
  );
}

// ─── Modal (higher-level convenience wrapper) ─────────────────────────────────

interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}

export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
}: ModalProps): JSX.Element {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={className}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {children}
        {footer && <DialogFooter>{footer}</DialogFooter>}
      </DialogContent>
    </Dialog>
  );
}
