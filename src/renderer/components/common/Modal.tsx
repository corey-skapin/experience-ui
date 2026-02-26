/**
 * Modal — higher-level convenience wrapper around the Dialog primitive.
 * Composes Dialog + DialogContent for common use cases (confirm, form, info).
 */
import type { ReactElement, ReactNode } from 'react'
import { Dialog, DialogContent } from './Dialog'
import { Button } from './Button'

export interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children?: ReactNode
  /** Custom footer; if omitted a default Close button is rendered. */
  footer?: ReactNode
  width?: string
  className?: string
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  width,
  className,
}: ModalProps): ReactElement {
  const defaultFooter = (
    <Button variant="secondary" size="sm" onClick={onClose}>
      Close
    </Button>
  )

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose()
      }}
    >
      <DialogContent
        title={title}
        description={description}
        footer={footer ?? defaultFooter}
        width={width}
        className={className}
      >
        {children}
      </DialogContent>
    </Dialog>
  )
}
