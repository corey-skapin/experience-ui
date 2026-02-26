import React from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';

export interface TooltipProps {
  content: string;
  children: React.ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
  delayDuration?: number;
}

export function Tooltip({
  content,
  children,
  side = 'top',
  delayDuration = 400,
}: TooltipProps): React.JSX.Element {
  return (
    <TooltipPrimitive.Provider delayDuration={delayDuration}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            side={side}
            className="bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] text-xs px-2 py-1 rounded-[var(--radius-sm)] shadow-[var(--shadow-md)] border border-[var(--color-border)] z-50"
            sideOffset={4}
          >
            {content}
            <TooltipPrimitive.Arrow className="fill-[var(--color-bg-primary)]" />
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}
