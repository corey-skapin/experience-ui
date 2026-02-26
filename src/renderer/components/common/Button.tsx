// src/renderer/components/common/Button.tsx
// Button and IconButton primitives (T014).
// Built on @radix-ui/react-slot for polymorphic rendering + Tailwind CSS.
import { Slot } from '@radix-ui/react-slot';
import { type JSX, type ButtonHTMLAttributes, forwardRef } from 'react';

// ─── Button ───────────────────────────────────────────────────────────────────

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Render as child component (Radix Slot pattern) */
  asChild?: boolean;
  /** Show loading spinner */
  loading?: boolean;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-[--color-accent-primary] text-[--color-text-inverse] hover:bg-[--color-accent-hover] ' +
    'active:bg-[--color-accent-active] disabled:opacity-50',
  secondary:
    'bg-[--color-surface-raised] text-[--color-text-primary] ' +
    'border border-[--color-border-default] hover:bg-[--color-surface-overlay] ' +
    'disabled:opacity-50',
  ghost:
    'bg-transparent text-[--color-text-secondary] hover:bg-[--color-surface-raised] ' +
    'hover:text-[--color-text-primary] disabled:opacity-50',
  danger:
    'bg-[--color-status-error] text-white hover:opacity-90 active:opacity-80 ' +
    'disabled:opacity-50',
  outline:
    'bg-transparent text-[--color-accent-primary] border border-[--color-accent-primary] ' +
    'hover:bg-[--color-status-info-bg] disabled:opacity-50',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-7 px-2.5 text-xs gap-1.5',
  md: 'h-9 px-3.5 text-sm gap-2',
  lg: 'h-11 px-5 text-base gap-2.5',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      asChild = false,
      loading = false,
      disabled,
      children,
      className = '',
      ...props
    },
    ref,
  ): JSX.Element => {
    const Comp = asChild ? Slot : 'button';

    const base =
      'inline-flex items-center justify-center font-medium rounded-[--radius-md] ' +
      'transition-colors duration-[--duration-fast] cursor-pointer select-none ' +
      'focus-visible:outline-2 focus-visible:outline-[--color-border-focus] focus-visible:outline-offset-2 ' +
      'disabled:cursor-not-allowed whitespace-nowrap';

    return (
      <Comp
        ref={ref}
        disabled={disabled ?? loading}
        className={`${base} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
        {...props}
      >
        {loading ? (
          <>
            <LoadingDots />
            {children}
          </>
        ) : (
          children
        )}
      </Comp>
    );
  },
);

Button.displayName = 'Button';

// ─── IconButton ───────────────────────────────────────────────────────────────

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Accessible label (required for icon-only buttons) */
  'aria-label': string;
}

const iconSizeClasses: Record<ButtonSize, string> = {
  sm: 'size-7',
  md: 'size-9',
  lg: 'size-11',
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ variant = 'ghost', size = 'md', className = '', ...props }, ref): JSX.Element => {
    const base =
      'inline-flex items-center justify-center rounded-[--radius-md] ' +
      'transition-colors duration-[--duration-fast] cursor-pointer ' +
      'focus-visible:outline-2 focus-visible:outline-[--color-border-focus] focus-visible:outline-offset-2 ' +
      'disabled:cursor-not-allowed disabled:opacity-50';

    return (
      <button
        ref={ref}
        className={`${base} ${variantClasses[variant]} ${iconSizeClasses[size]} ${className}`}
        {...props}
      />
    );
  },
);

IconButton.displayName = 'IconButton';

// ─── Internal: Loading Dots ───────────────────────────────────────────────────

function LoadingDots(): JSX.Element {
  return (
    <span className="inline-flex gap-0.5 items-center" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="size-1 rounded-full bg-current animate-pulse"
          style={{ animationDelay: `${i * 150}ms` }}
        />
      ))}
    </span>
  );
}
