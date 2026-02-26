// src/renderer/components/common/Tooltip.tsx
// Tooltip and EmptyState primitives (T014).
// Tooltip built on @radix-ui/react-tooltip.
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import type { JSX, ReactNode, HTMLAttributes } from 'react';

// ─── Tooltip Provider (wrap app root) ────────────────────────────────────────

export const TooltipProvider = TooltipPrimitive.Provider;

// ─── Tooltip ─────────────────────────────────────────────────────────────────

interface TooltipProps {
  /** Tooltip content */
  content: ReactNode;
  /** Trigger element */
  children: ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
  delayDuration?: number;
  className?: string;
}

export function Tooltip({
  content,
  children,
  side = 'top',
  align = 'center',
  delayDuration = 400,
  className = '',
}: TooltipProps): JSX.Element {
  return (
    <TooltipPrimitive.Root delayDuration={delayDuration}>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          align={align}
          sideOffset={6}
          className={
            'z-[--z-tooltip] px-2.5 py-1.5 ' +
            'rounded-[--radius-md] ' +
            'bg-[--color-surface-overlay] text-[--color-text-primary] ' +
            'border border-[--color-border-default] ' +
            'shadow-[--shadow-md] ' +
            'text-xs font-medium ' +
            'select-none ' +
            'data-[state=delayed-open]:data-[side=top]:animate-slideDownAndFade ' +
            'data-[state=delayed-open]:data-[side=bottom]:animate-slideUpAndFade ' +
            `${className}`
          }
        >
          {content}
          <TooltipPrimitive.Arrow
            className="fill-[--color-border-default]"
            width={8}
            height={4}
          />
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}

// ─── EmptyState ───────────────────────────────────────────────────────────────

interface EmptyStateProps extends HTMLAttributes<HTMLDivElement> {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className = '',
  ...props
}: EmptyStateProps): JSX.Element {
  return (
    <div
      className={
        `flex flex-col items-center justify-center gap-3 p-8 text-center ${className}`
      }
      {...props}
    >
      {icon && (
        <div
          className="flex items-center justify-center size-12 rounded-[--radius-xl] bg-[--color-surface-raised] text-[--color-text-tertiary]"
          aria-hidden="true"
        >
          {icon}
        </div>
      )}
      <div className="space-y-1">
        <p className="text-sm font-medium text-[--color-text-primary]">{title}</p>
        {description && (
          <p className="text-xs text-[--color-text-secondary] max-w-xs">{description}</p>
        )}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
