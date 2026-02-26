import { create } from 'zustand';
import type { Tab, ChatMessage, CustomizationRequest } from '../../shared/types';

type TabStatus = 'empty' | 'spec-loaded' | 'generating' | 'interface-ready';

interface TabStoreState {
  tab: Tab;
  status: TabStatus;
  setSpec: (spec: Tab['apiSpec']) => void;
  setGeneratedInterface: (iface: Tab['generatedInterface']) => void;
  addMessage: (message: ChatMessage) => void;
  updateMessageStatus: (messageId: string, status: ChatMessage['status']) => void;
  enqueueCustomization: (request: CustomizationRequest) => void;
  setStatus: (status: TabStatus) => void;
}

const DEFAULT_TAB: Tab = {
  id: 'tab-1',
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

export const useTabStore = create<TabStoreState>((set) => ({
  tab: DEFAULT_TAB,
  status: 'empty',

  setSpec: (spec) =>
    set((s) => ({
      tab: { ...s.tab, apiSpec: spec },
      status: spec ? 'spec-loaded' : 'empty',
    })),

  setGeneratedInterface: (iface) =>
    set((s) => ({
      tab: { ...s.tab, generatedInterface: iface },
      status: iface ? 'interface-ready' : s.status,
    })),

  addMessage: (message) =>
    set((s) => ({
      tab: { ...s.tab, chatHistory: [...s.tab.chatHistory, message] },
    })),

  updateMessageStatus: (messageId, status) =>
    set((s) => ({
      tab: {
        ...s.tab,
        chatHistory: s.tab.chatHistory.map((m) => (m.id === messageId ? { ...m, status } : m)),
      },
    })),

  enqueueCustomization: (request) =>
    set((s) => ({
      tab: { ...s.tab, customizationQueue: [...s.tab.customizationQueue, request] },
    })),

  setStatus: (status) => set({ status }),
}));
