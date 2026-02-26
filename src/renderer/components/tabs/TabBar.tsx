// src/renderer/components/tabs/TabBar.tsx
// T080 + T082 — Horizontal tab strip with DnD reorder and close confirmation.

import { type JSX, useState } from 'react';
import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable';

import type { Tab } from '../../../shared/types';
import { useTabStore } from '../../stores/tab-store';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../common/Modal';
import { Button } from '../common/Button';
import { TabItem } from './TabItem';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface TabBarProps {
  tabs: Tab[];
  activeTabId: string | null;
  onNewTab: () => void;
  onSwitchTab: (id: string) => void;
  onRenameTab: (id: string, title: string) => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function TabBar({
  tabs,
  activeTabId,
  onNewTab,
  onSwitchTab,
  onRenameTab,
}: TabBarProps): JSX.Element {
  const [pendingCloseId, setPendingCloseId] = useState<string | null>(null);
  const { closeTab, closeTabForced, reorderTab } = useTabStore.getState();

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const sorted = [...tabs].sort((a, b) => a.displayOrder - b.displayOrder);

  const handleClose = (id: string) => {
    const result = closeTab(id);
    if (result.requiresConfirmation) {
      setPendingCloseId(id);
    }
  };

  const handleConfirmClose = () => {
    if (pendingCloseId) {
      closeTabForced(pendingCloseId);
    }
    setPendingCloseId(null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const overTab = tabs.find((t) => t.id === over.id);
    if (overTab) reorderTab(String(active.id), overTab.displayOrder);
  };

  return (
    <>
      <div
        role="tablist"
        aria-label="Open tabs"
        style={{
          display: 'flex',
          alignItems: 'center',
          overflowX: 'auto',
          background: 'var(--color-surface-sunken)',
          borderBottom: '1px solid var(--color-border-default)',
          minHeight: 36,
          flexShrink: 0,
        }}
      >
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <SortableContext
            items={sorted.map((t) => t.id)}
            strategy={horizontalListSortingStrategy}
          >
            {sorted.map((tab) => (
              <TabItem
                key={tab.id}
                tab={tab}
                isActive={tab.id === activeTabId}
                onClose={() => handleClose(tab.id)}
                onSwitch={() => onSwitchTab(tab.id)}
                onRename={(title) => onRenameTab(tab.id, title)}
              />
            ))}
          </SortableContext>
        </DndContext>

        <button
          type="button"
          onClick={onNewTab}
          aria-label="New tab"
          style={{
            padding: '4px 10px',
            flexShrink: 0,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: 18,
            color: 'var(--color-text-secondary)',
          }}
        >
          +
        </button>
      </div>

      {/* Close confirmation dialog */}
      <Dialog open={pendingCloseId !== null} onOpenChange={() => setPendingCloseId(null)}>
        <DialogContent aria-label="Confirm close tab">
          <DialogHeader>
            <DialogTitle>Close tab?</DialogTitle>
            <DialogDescription>
              This tab has a loaded spec. Closing it will discard any unsaved changes.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setPendingCloseId(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleConfirmClose}>
              Close tab
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
