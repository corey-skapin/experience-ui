// src/renderer/hooks/use-tabs.ts
// T079 — Hook for multi-tab management.
// Wraps tab store with close confirmation logic.

import { useCallback } from 'react';

import type { Tab } from '../../shared/types';
import { useTabStore } from '../stores/tab-store';

// ─── Return Type ──────────────────────────────────────────────────────────────

export interface UseTabsReturn {
  tabs: Tab[];
  activeTab: Tab | undefined;
  activeTabId: string | null;
  tabCount: number;
  createTab(): void;
  closeTab(id: string): void;
  switchTab(id: string): void;
  renameTab(id: string, title: string): void;
  reorderTab(id: string, newIndex: number): void;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useTabs(): UseTabsReturn {
  const tabs = useTabStore((s) => s.tabs);
  const activeTabId = useTabStore((s) => s.activeTabId);
  const activeTab = useTabStore((s) => s.tabs.find((t) => t.id === s.activeTabId));

  const { createTab, closeTabForced, switchTab, renameTab, reorderTab } = useTabStore.getState();

  const closeTab = useCallback(
    (id: string): void => {
      const result = useTabStore.getState().closeTab(id);
      if (result.requiresConfirmation) {
        const confirmed = window.confirm(
          'This tab has a loaded spec. Close anyway and discard changes?',
        );
        if (confirmed) {
          closeTabForced(id);
        }
      }
    },
    [closeTabForced],
  );

  return {
    tabs,
    activeTab,
    activeTabId,
    tabCount: tabs.length,
    createTab,
    closeTab,
    switchTab,
    renameTab,
    reorderTab,
  };
}
