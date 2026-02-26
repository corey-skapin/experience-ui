// src/renderer/stores/tab-store.ts
// T078 — Multi-tab Zustand store.
// Manages Tab[] with independent state per tab.
// State transitions per tab: empty → spec-loaded → generating → interface-ready.

import { create } from 'zustand';

import type {
  APISpec,
  ChatMessage,
  ConsoleEntry,
  CustomizationRequest,
  Tab,
} from '../../shared/types';

// ─── Tab Status ───────────────────────────────────────────────────────────────

export type TabStatus = 'empty' | 'spec-loaded' | 'generating' | 'interface-ready';

// ─── Close Result ─────────────────────────────────────────────────────────────

export interface CloseTabResult {
  removed: boolean;
  requiresConfirmation?: boolean;
  newActiveTabId?: string | null;
}

// ─── State Shape ──────────────────────────────────────────────────────────────

export interface TabStoreState {
  tabs: Tab[];
  activeTabId: string | null;
  /** Lifecycle status per tabId. */
  tabStatuses: Record<string, TabStatus>;
  /** Console entries per tabId (stored separately to keep Tab type clean). */
  consoleEntries: Record<string, ConsoleEntry[]>;

  // ── Tab Management ─────────────────────────────────────────────────────────
  createTab(): Tab;
  closeTab(id: string): CloseTabResult;
  closeTabForced(id: string): void;
  switchTab(id: string): void;
  renameTab(id: string, title: string): void;
  reorderTab(id: string, newIndex: number): void;
  getActiveTab(): Tab | undefined;

  // ── Per-tab Spec / Status ──────────────────────────────────────────────────
  loadSpec(tabId: string, spec: APISpec): void;
  clearSpec(tabId: string): void;
  startGenerating(tabId: string): void;
  finishGenerating(tabId: string): void;
  setTabStatus(tabId: string, status: TabStatus): void;

  // ── Per-tab Chat ───────────────────────────────────────────────────────────
  addChatMessage(tabId: string, message: ChatMessage): void;
  updateChatMessage(tabId: string, id: string, update: Partial<ChatMessage>): void;
  removeChatMessage(tabId: string, id: string): void;

  // ── Per-tab Customization Queue ────────────────────────────────────────────
  enqueueCustomization(tabId: string, request: CustomizationRequest): void;
  updateCustomization(tabId: string, id: string, update: Partial<CustomizationRequest>): void;
  dequeueCustomization(tabId: string, id: string): void;

  // ── Per-tab Console ───────────────────────────────────────────────────────
  addConsoleEntry(tabId: string, entry: ConsoleEntry): void;
  clearConsoleEntries(tabId: string): void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeTab(displayOrder: number): Tab {
  return {
    id: crypto.randomUUID(),
    title: 'New Tab',
    displayOrder,
    isActive: false,
    apiSpec: null,
    generatedInterface: null,
    connectionId: null,
    chatHistory: [],
    customizationQueue: [],
    createdAt: new Date().toISOString(),
  };
}

function updateTab(tabs: Tab[], id: string, patch: Partial<Tab>): Tab[] {
  return tabs.map((t) => (t.id === id ? { ...t, ...patch } : t));
}

function pickNextActiveId(tabs: Tab[], removedId: string): string | null {
  const rest = tabs.filter((t) => t.id !== removedId);
  if (rest.length === 0) return null;
  return [...rest].sort((a, b) => a.displayOrder - b.displayOrder)[0].id;
}

function removeTabState(s: TabStoreState, id: string, nextId: string | null): Partial<TabStoreState> {
  const { [id]: _s, ...tabStatuses } = s.tabStatuses;
  const { [id]: _c, ...consoleEntries } = s.consoleEntries;
  return { tabs: s.tabs.filter((t) => t.id !== id), activeTabId: nextId, tabStatuses, consoleEntries };
}

const _first = makeTab(0);

export const useTabStore = create<TabStoreState>()((set, get) => ({
  tabs: [_first],
  activeTabId: _first.id,
  tabStatuses: { [_first.id]: 'empty' },
  consoleEntries: {},

  // ── Tab Management ─────────────────────────────────────────────────────────

  createTab() {
    const order = get().tabs.length;
    const tab = makeTab(order);
    set((s) => ({
      tabs: [...s.tabs, tab],
      activeTabId: tab.id,
      tabStatuses: { ...s.tabStatuses, [tab.id]: 'empty' },
    }));
    return tab;
  },

  closeTab(id: string): CloseTabResult {
    const tab = get().tabs.find((t) => t.id === id);
    if (!tab) return { removed: false };
    if (tab.apiSpec !== null) return { removed: false, requiresConfirmation: true };
    const newActiveTabId = get().activeTabId === id ? pickNextActiveId(get().tabs, id) : get().activeTabId;
    set((s) => removeTabState(s, id, newActiveTabId));
    return { removed: true, newActiveTabId };
  },

  closeTabForced(id: string) {
    const newActiveTabId = get().activeTabId === id ? pickNextActiveId(get().tabs, id) : get().activeTabId;
    set((s) => removeTabState(s, id, newActiveTabId));
  },

  switchTab(id: string) {
    set({ activeTabId: id });
  },

  renameTab(id: string, title: string) {
    set((s) => ({ tabs: updateTab(s.tabs, id, { title }) }));
  },

  reorderTab(id: string, newIndex: number) {
    set((s) => ({ tabs: updateTab(s.tabs, id, { displayOrder: newIndex }) }));
  },

  getActiveTab(): Tab | undefined {
    const { tabs, activeTabId } = get();
    return tabs.find((t) => t.id === activeTabId);
  },

  // ── Per-tab Spec / Status ──────────────────────────────────────────────────

  loadSpec(tabId: string, spec: APISpec) {
    set((s) => ({
      tabs: updateTab(s.tabs, tabId, { apiSpec: spec, title: spec.metadata.title || 'Untitled' }),
      tabStatuses: { ...s.tabStatuses, [tabId]: 'spec-loaded' },
    }));
  },

  clearSpec(tabId: string) {
    set((s) => ({
      tabs: updateTab(s.tabs, tabId, { apiSpec: null, generatedInterface: null }),
      tabStatuses: { ...s.tabStatuses, [tabId]: 'empty' },
    }));
  },

  startGenerating(tabId: string) {
    const tab = get().tabs.find((t) => t.id === tabId);
    if (!tab?.apiSpec) return;
    set((s) => ({ tabStatuses: { ...s.tabStatuses, [tabId]: 'generating' } }));
  },

  finishGenerating(tabId: string) {
    set((s) => ({ tabStatuses: { ...s.tabStatuses, [tabId]: 'interface-ready' } }));
  },

  setTabStatus(tabId: string, status: TabStatus) {
    set((s) => ({ tabStatuses: { ...s.tabStatuses, [tabId]: status } }));
  },

  // ── Per-tab Chat ───────────────────────────────────────────────────────────

  addChatMessage(tabId: string, message: ChatMessage) {
    set((s) => ({
      tabs: updateTab(s.tabs, tabId, {
        chatHistory: [...(s.tabs.find((t) => t.id === tabId)?.chatHistory ?? []), message],
      }),
    }));
  },

  updateChatMessage(tabId: string, id: string, update: Partial<ChatMessage>) {
    set((s) => {
      const tab = s.tabs.find((t) => t.id === tabId);
      if (!tab) return s;
      return {
        tabs: updateTab(s.tabs, tabId, {
          chatHistory: tab.chatHistory.map((m) => (m.id === id ? { ...m, ...update } : m)),
        }),
      };
    });
  },

  removeChatMessage(tabId: string, id: string) {
    set((s) => {
      const tab = s.tabs.find((t) => t.id === tabId);
      if (!tab) return s;
      return {
        tabs: updateTab(s.tabs, tabId, {
          chatHistory: tab.chatHistory.filter((m) => m.id !== id),
        }),
      };
    });
  },

  // ── Per-tab Customization Queue ────────────────────────────────────────────

  enqueueCustomization(tabId: string, request: CustomizationRequest) {
    set((s) => {
      const tab = s.tabs.find((t) => t.id === tabId);
      if (!tab) return s;
      return {
        tabs: updateTab(s.tabs, tabId, {
          customizationQueue: [...tab.customizationQueue, request],
        }),
      };
    });
  },

  updateCustomization(tabId: string, id: string, update: Partial<CustomizationRequest>) {
    set((s) => {
      const tab = s.tabs.find((t) => t.id === tabId);
      if (!tab) return s;
      return {
        tabs: updateTab(s.tabs, tabId, {
          customizationQueue: tab.customizationQueue.map((r) =>
            r.id === id ? { ...r, ...update } : r,
          ),
        }),
      };
    });
  },

  dequeueCustomization(tabId: string, id: string) {
    set((s) => {
      const tab = s.tabs.find((t) => t.id === tabId);
      if (!tab) return s;
      return {
        tabs: updateTab(s.tabs, tabId, {
          customizationQueue: tab.customizationQueue.filter((r) => r.id !== id),
        }),
      };
    });
  },

  // ── Per-tab Console ───────────────────────────────────────────────────────

  addConsoleEntry(tabId: string, entry: ConsoleEntry) {
    set((s) => ({
      consoleEntries: {
        ...s.consoleEntries,
        [tabId]: [...(s.consoleEntries[tabId] ?? []), entry],
      },
    }));
  },

  clearConsoleEntries(tabId: string) {
    set((s) => ({ consoleEntries: { ...s.consoleEntries, [tabId]: [] } }));
  },
}));

// ─── Stable empty fallback ────────────────────────────────────────────────────

const EMPTY_CONSOLE_ENTRIES: ConsoleEntry[] = [];

// ─── Selectors ────────────────────────────────────────────────────────────────

export const selectActiveTab = (s: TabStoreState): Tab | undefined =>
  s.tabs.find((t) => t.id === s.activeTabId);

export const selectTabs = (s: TabStoreState): Tab[] => s.tabs;

export const selectTabById =
  (id: string) =>
  (s: TabStoreState): Tab | undefined =>
    s.tabs.find((t) => t.id === id);

export const selectConsoleEntries =
  (tabId: string) =>
  (s: TabStoreState): ConsoleEntry[] =>
    s.consoleEntries[tabId] ?? EMPTY_CONSOLE_ENTRIES;

export const selectActiveTabStatus = (s: TabStoreState): TabStatus => {
  const active = s.tabs.find((t) => t.id === s.activeTabId);
  return active ? (s.tabStatuses[active.id] ?? 'empty') : 'empty';
};
