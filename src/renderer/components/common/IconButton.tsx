/**
 * IconButton component — a square button containing only an icon.
 * Wraps the Button component with icon-specific sizing and an accessible label.
 */
import { forwardRef } from 'react'
import type { ReactNode } from 'react'
import type { ButtonProps } from './Button'
import { Button } from './Button'

const iconSizeStyles = {
  sm: 'h-7 w-7 px-0',
  md: 'h-9 w-9 px-0',
  lg: 'h-11 w-11 px-0',
}

export interface IconButtonProps extends Omit<ButtonProps, 'leftIcon' | 'rightIcon' | 'asChild'> {
  /** Accessible label for screen readers (required). */
  label: string
  icon: ReactNode
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ label, icon, size = 'md', className = '', ...props }, ref) => {
    return (
      <Button
        ref={ref}
        size={size}
        aria-label={label}
        className={[iconSizeStyles[size], className].filter(Boolean).join(' ')}
        {...props}
      >
        {icon}
      </Button>
    )
  },
)

IconButton.displayName = 'IconButton'
