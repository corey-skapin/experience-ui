// src/renderer/components/chat/ClarificationCard.tsx
// T062 — Card component for CLI clarification questions.
// Renders a question with selectable option buttons.

import type { JSX } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ClarificationCardProps {
  question: string;
  options: string[];
  onSelect: (option: string) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ClarificationCard({
  question,
  options,
  onSelect,
}: ClarificationCardProps): JSX.Element {
  return (
    <div
      role="group"
      aria-label="Clarification needed"
      style={{
        margin: 'var(--spacing-2) var(--spacing-4)',
        padding: 'var(--spacing-3)',
        background: 'var(--color-surface-raised)',
        border: '1px solid var(--color-border-default)',
        borderRadius: 'var(--radius-md)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--spacing-2)',
      }}
    >
      {/* Question text */}
      <p
        style={{
          margin: 0,
          fontSize: 'var(--text-sm)',
          color: 'var(--color-text-primary)',
          fontWeight: 500,
        }}
      >
        {question}
      </p>

      {/* Option buttons */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 'var(--spacing-2)',
        }}
      >
        {options.map((option) => (
          <button
            key={option}
            type="button"
            aria-label={`Select option: ${option}`}
            onClick={() => onSelect(option)}
            style={{
              padding: '4px var(--spacing-3)',
              background: 'var(--color-bg-primary)',
              border: '1px solid var(--color-accent-primary)',
              borderRadius: 'var(--radius-full)',
              color: 'var(--color-accent-primary)',
              fontSize: 'var(--text-xs)',
              cursor: 'pointer',
              transition: 'background 0.1s ease, color 0.1s ease',
            }}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}
