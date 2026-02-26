import React from 'react';

export interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({
  title,
  description,
  icon,
  action,
}: EmptyStateProps): React.JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center">
      {icon && (
        <div className="mb-4 text-[var(--color-text-disabled)] text-4xl" aria-hidden="true">
          {icon}
        </div>
      )}
      <h3 className="text-lg font-medium text-[var(--color-text-primary)] mb-2">{title}</h3>
      {description && (
        <p className="text-[var(--color-text-secondary)] text-sm mb-6 max-w-md">{description}</p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="px-4 py-2 bg-[var(--color-accent)] text-[var(--color-text-inverse)] rounded-[var(--radius-md)] hover:bg-[var(--color-accent-hover)] transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
