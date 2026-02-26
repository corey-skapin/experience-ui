import React from 'react';

export interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  label?: string;
}

const sizeClasses = {
  sm: 'w-4 h-4 border-2',
  md: 'w-8 h-8 border-2',
  lg: 'w-12 h-12 border-4',
};

export function LoadingSpinner({
  size = 'md',
  label = 'Loading...',
}: LoadingSpinnerProps): React.JSX.Element {
  return (
    <div role="status" className="flex items-center justify-center">
      <span
        className={[
          sizeClasses[size],
          'animate-spin rounded-full border-[var(--color-border)] border-t-[var(--color-accent)]',
        ].join(' ')}
        aria-hidden="true"
      />
      <span className="sr-only">{label}</span>
    </div>
  );
}
