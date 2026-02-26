// src/renderer/stores/tab-store.ts
// T026 — Zustand store for tab state (single-tab MVP).
// Manages a single Tab with all fields from the data model.
// State transitions: empty → spec-loaded → generating → interface-ready.

import { create } from 'zustand';

import type { APISpec, ChatMessage, CustomizationRequest, Tab } from '../../shared/types';

// ─── Tab Status ───────────────────────────────────────────────────────────────

/** Lifecycle status of the single MVP tab. */
export type TabStatus = 'empty' | 'spec-loaded' | 'generating' | 'interface-ready';

// ─── State Shape ──────────────────────────────────────────────────────────────

interface TabStoreState {
  /** The single active tab (created on store init). */
  tab: Tab;

  /** High-level lifecycle status derived from tab content. */
  tabStatus: TabStatus;

  // ── Tab Actions ────────────────────────────────────────────────────────────

  /** Load a parsed API spec into the tab. Transitions to 'spec-loaded'. */
  loadSpec(spec: APISpec): void;

  /** Clear the spec and reset to 'empty'. */
  clearSpec(): void;

  /** Mark generation as in-progress. Transitions to 'generating'. */
  startGenerating(): void;

  /** Mark generation as complete. Transitions to 'interface-ready'. */
  finishGenerating(): void;

  /** Update tab title. */
  setTitle(title: string): void;

  // ── Chat Actions ───────────────────────────────────────────────────────────

  /** Append a chat message to chatHistory. */
  addChatMessage(message: ChatMessage): void;

  /** Update an existing chat message by ID. */
  updateChatMessage(id: string, update: Partial<ChatMessage>): void;

  /** Remove a chat message by ID. */
  removeChatMessage(id: string): void;

  // ── Customization Queue Actions ────────────────────────────────────────────

  /** Enqueue a customization request. */
  enqueueCustomization(request: CustomizationRequest): void;

  /** Update a customization request by ID. */
  updateCustomization(id: string, update: Partial<CustomizationRequest>): void;

  /** Remove a completed or failed customization request from the queue. */
  dequeueCustomization(id: string): void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function createInitialTab(): Tab {
  return {
    id: crypto.randomUUID(),
    title: 'New Tab',
    displayOrder: 0,
    isActive: true,
    apiSpec: null,
    generatedInterface: null,
    connectionId: null,
    chatHistory: [],
    customizationQueue: [],
    createdAt: new Date().toISOString(),
  };
}

function deriveStatus(tab: Tab): TabStatus {
  if (tab.generatedInterface !== null) return 'interface-ready';
  if (tab.apiSpec !== null) return 'spec-loaded';
  return 'empty';
}

// ─── Store ────────────────────────────────────────────────────────────────────

const initialTab = createInitialTab();

export const useTabStore = create<TabStoreState>()((set, get) => ({
  tab: initialTab,
  tabStatus: 'empty',

  // ── Tab Actions ────────────────────────────────────────────────────────────

  loadSpec(spec: APISpec) {
    set((s) => {
      const tab = { ...s.tab, apiSpec: spec, title: spec.metadata.title || 'Untitled' };
      return { tab, tabStatus: deriveStatus(tab) };
    });
  },

  clearSpec() {
    set((s) => {
      const tab = { ...s.tab, apiSpec: null, generatedInterface: null };
      return { tab, tabStatus: 'empty' };
    });
  },

  startGenerating() {
    // Must have a spec loaded before generating
    if (get().tab.apiSpec === null) return;
    set({ tabStatus: 'generating' });
  },

  finishGenerating() {
    set({ tabStatus: 'interface-ready' });
  },

  setTitle(title: string) {
    set((s) => ({ tab: { ...s.tab, title } }));
  },

  // ── Chat Actions ───────────────────────────────────────────────────────────

  addChatMessage(message: ChatMessage) {
    set((s) => ({
      tab: { ...s.tab, chatHistory: [...s.tab.chatHistory, message] },
    }));
  },

  updateChatMessage(id: string, update: Partial<ChatMessage>) {
    set((s) => ({
      tab: {
        ...s.tab,
        chatHistory: s.tab.chatHistory.map((m) => (m.id === id ? { ...m, ...update } : m)),
      },
    }));
  },

  removeChatMessage(id: string) {
    set((s) => ({
      tab: { ...s.tab, chatHistory: s.tab.chatHistory.filter((m) => m.id !== id) },
    }));
  },

  // ── Customization Queue Actions ────────────────────────────────────────────

  enqueueCustomization(request: CustomizationRequest) {
    set((s) => ({
      tab: {
        ...s.tab,
        customizationQueue: [...s.tab.customizationQueue, request],
      },
    }));
  },

  updateCustomization(id: string, update: Partial<CustomizationRequest>) {
    set((s) => ({
      tab: {
        ...s.tab,
        customizationQueue: s.tab.customizationQueue.map((r) =>
          r.id === id ? { ...r, ...update } : r,
        ),
      },
    }));
  },

  dequeueCustomization(id: string) {
    set((s) => ({
      tab: {
        ...s.tab,
        customizationQueue: s.tab.customizationQueue.filter((r) => r.id !== id),
      },
    }));
  },
}));

// ─── Selectors ────────────────────────────────────────────────────────────────

export const selectTab = (state: TabStoreState): Tab => state.tab;
export const selectTabStatus = (state: TabStoreState): TabStatus => state.tabStatus;
export const selectChatHistory = (state: TabStoreState): ChatMessage[] => state.tab.chatHistory;
export const selectCustomizationQueue = (state: TabStoreState): CustomizationRequest[] =>
  state.tab.customizationQueue;
export const selectApiSpec = (state: TabStoreState): APISpec | null => state.tab.apiSpec;
