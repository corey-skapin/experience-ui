import React from 'react';

export interface ProgressBarProps {
  value: number;
  max?: number;
  label?: string;
  showPercent?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const sizeClasses = {
  sm: 'h-1',
  md: 'h-2',
  lg: 'h-3',
};

export function ProgressBar({
  value,
  max = 100,
  label,
  showPercent = false,
  size = 'md',
}: ProgressBarProps): React.JSX.Element {
  const percent = Math.min(100, Math.max(0, (value / max) * 100));

  return (
    <div className="w-full">
      {(label || showPercent) && (
        <div className="flex justify-between mb-1 text-sm text-[var(--color-text-secondary)]">
          {label && <span>{label}</span>}
          {showPercent && <span>{Math.round(percent)}%</span>}
        </div>
      )}
      <div
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={label}
        className={[
          'w-full bg-[var(--color-bg-tertiary)] rounded-full overflow-hidden',
          sizeClasses[size],
        ].join(' ')}
      >
        <div
          className="h-full bg-[var(--color-accent)] transition-all duration-300 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
