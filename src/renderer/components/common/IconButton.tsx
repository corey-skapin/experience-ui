import React from 'react';
import type { ButtonVariant, ButtonSize } from './Button';

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode;
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'w-7 h-7',
  md: 'w-9 h-9',
  lg: 'w-11 h-11',
};

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-[var(--color-accent)] text-[var(--color-text-inverse)] hover:bg-[var(--color-accent-hover)]',
  secondary:
    'bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] hover:bg-[var(--color-border)] border border-[var(--color-border)]',
  ghost: 'bg-transparent text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)]',
  danger: 'bg-[var(--color-error)] text-white hover:opacity-90',
};

export function IconButton({
  icon,
  label,
  variant = 'ghost',
  size = 'md',
  isLoading = false,
  disabled,
  className = '',
  ...props
}: IconButtonProps): React.JSX.Element {
  return (
    <button
      {...props}
      disabled={disabled || isLoading}
      aria-label={label}
      aria-busy={isLoading}
      className={[
        'inline-flex items-center justify-center rounded-[var(--radius-md)] transition-colors duration-150 cursor-pointer',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        variantClasses[variant],
        sizeClasses[size],
        className,
      ].join(' ')}
    >
      {isLoading ? (
        <span
          className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full"
          aria-hidden="true"
        />
      ) : (
        icon
      )}
    </button>
  );
}
