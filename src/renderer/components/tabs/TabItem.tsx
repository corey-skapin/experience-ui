// src/renderer/components/tabs/TabItem.tsx
// T081 — Individual tab item with inline rename, close, and drag support.

import { type JSX, type KeyboardEvent, type CSSProperties, useCallback, useRef, useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import type { Tab } from '../../../shared/types';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface TabItemProps {
  tab: Tab;
  isActive: boolean;
  onClose: () => void;
  onSwitch: () => void;
  onRename: (title: string) => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function TabItem({ tab, isActive, onClose, onSwitch, onRename }: TabItemProps): JSX.Element {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(tab.title);
  const inputRef = useRef<HTMLInputElement>(null);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: tab.id,
  });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const truncated = tab.title.length > 20 ? tab.title.slice(0, 20) + '…' : tab.title;

  const startEditing = useCallback(() => {
    setEditValue(tab.title);
    setIsEditing(true);
    setTimeout(() => inputRef.current?.select(), 0);
  }, [tab.title]);

  const commitRename = useCallback(() => {
    const trimmed = editValue.trim();
    if (trimmed) onRename(trimmed);
    setIsEditing(false);
  }, [editValue, onRename]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') commitRename();
      if (e.key === 'Escape') setIsEditing(false);
    },
    [commitRename],
  );

  // spec loaded but interface generation not yet complete
  const hasPendingGeneration = tab.apiSpec !== null && tab.generatedInterface === null;

  return (
    <div
      ref={setNodeRef}
      style={style}
      role="tab"
      aria-selected={isActive}
      tabIndex={isActive ? 0 : -1}
      className={[
        'tab-item',
        isActive ? 'tab-item--active' : '',
      ].join(' ')}
      {...attributes}
      {...listeners}
    >
      {isEditing ? (
        <input
          ref={inputRef}
          className="tab-item__rename-input"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={commitRename}
          onKeyDown={handleKeyDown}
          aria-label="Rename tab"
          autoFocus
        />
      ) : (
        <button
          type="button"
          className="tab-item__label"
          onClick={onSwitch}
          onDoubleClick={startEditing}
          title={tab.title}
        >
          {hasPendingGeneration && <span className="tab-item__unsaved-dot" aria-label="unsaved" />}
          {truncated}
        </button>
      )}
      <button
        type="button"
        className="tab-item__close"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        aria-label={`Close tab ${tab.title}`}
      >
        ×
      </button>
    </div>
  );
}
