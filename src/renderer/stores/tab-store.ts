/**
 * Tab Zustand store (single-tab MVP for User Story 1).
 * Manages one Tab with id, title, apiSpec, generatedInterface,
 * chatHistory, and customizationQueue.
 * State transitions: empty → spec-loaded → generating → interface-ready → error
 */
import { create } from 'zustand'
import type {
  Tab,
  TabStatus,
  APISpec,
  GeneratedInterface,
  ChatMessage,
  CustomizationRequest,
  MessageRole,
  MessageStatus,
} from '../../shared/types'

// ─── Initial tab ──────────────────────────────────────────────────────────

function createInitialTab(): Tab {
  return {
    id: 'tab-1',
    title: 'New Tab',
    displayOrder: 0,
    isActive: true,
    apiSpec: null,
    generatedInterface: null,
    connectionId: null,
    chatHistory: [],
    customizationQueue: [],
    status: 'empty',
    createdAt: Date.now(),
  }
}

// ─── Store state ──────────────────────────────────────────────────────────

export interface TabStoreState {
  tab: Tab
  activeTabId: string

  // ─── Spec actions ───────────────────────────────────────────────────────

  setApiSpec: (spec: APISpec | null) => void
  setGeneratedInterface: (iface: GeneratedInterface | null) => void
  setTabStatus: (status: TabStatus) => void
  setTabTitle: (title: string) => void

  // ─── Chat actions ────────────────────────────────────────────────────────

  addChatMessage: (
    role: MessageRole,
    content: string,
    options?: Partial<Pick<ChatMessage, 'attachments' | 'status'>>,
  ) => string
  updateChatMessage: (id: string, updates: Partial<ChatMessage>) => void
  setChatMessageStatus: (id: string, status: MessageStatus) => void

  // ─── Customization actions ───────────────────────────────────────────────

  enqueueCustomization: (request: CustomizationRequest) => void
  updateCustomization: (id: string, updates: Partial<CustomizationRequest>) => void
  removeCustomization: (id: string) => void

  // ─── Reset ──────────────────────────────────────────────────────────────

  reset: () => void
}

// ─── Store ────────────────────────────────────────────────────────────────

export const useTabStore = create<TabStoreState>((set, get) => ({
  tab: createInitialTab(),
  activeTabId: 'tab-1',

  setApiSpec: (spec) =>
    set((state) => ({
      tab: {
        ...state.tab,
        apiSpec: spec,
        status: spec ? 'spec-loaded' : 'empty',
        title: spec?.metadata.title ?? state.tab.title,
      },
    })),

  setGeneratedInterface: (iface) =>
    set((state) => ({
      tab: {
        ...state.tab,
        generatedInterface: iface,
        status: iface ? 'interface-ready' : state.tab.status,
      },
    })),

  setTabStatus: (status) =>
    set((state) => ({
      tab: { ...state.tab, status },
    })),

  setTabTitle: (title) =>
    set((state) => ({
      tab: { ...state.tab, title },
    })),

  addChatMessage: (role, content, options = {}) => {
    const id = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const message: ChatMessage = {
      id,
      tabId: get().tab.id,
      role,
      content,
      timestamp: Date.now(),
      status: options.status ?? 'sent',
      attachments: options.attachments,
      relatedVersionId: null,
    }
    set((state) => ({
      tab: {
        ...state.tab,
        chatHistory: [...state.tab.chatHistory, message],
      },
    }))
    return id
  },

  updateChatMessage: (id, updates) =>
    set((state) => ({
      tab: {
        ...state.tab,
        chatHistory: state.tab.chatHistory.map((m) => (m.id === id ? { ...m, ...updates } : m)),
      },
    })),

  setChatMessageStatus: (id, status) =>
    set((state) => ({
      tab: {
        ...state.tab,
        chatHistory: state.tab.chatHistory.map((m) => (m.id === id ? { ...m, status } : m)),
      },
    })),

  enqueueCustomization: (request) =>
    set((state) => ({
      tab: {
        ...state.tab,
        customizationQueue: [...state.tab.customizationQueue, request],
      },
    })),

  updateCustomization: (id, updates) =>
    set((state) => ({
      tab: {
        ...state.tab,
        customizationQueue: state.tab.customizationQueue.map((r) =>
          r.id === id ? { ...r, ...updates } : r,
        ),
      },
    })),

  removeCustomization: (id) =>
    set((state) => ({
      tab: {
        ...state.tab,
        customizationQueue: state.tab.customizationQueue.filter((r) => r.id !== id),
      },
    })),

  reset: () => set({ tab: createInitialTab(), activeTabId: 'tab-1' }),
}))
