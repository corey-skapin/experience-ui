import { create } from 'zustand';
import {
  DEFAULT_CHAT_PANEL_WIDTH,
  MAX_CHAT_PANEL_WIDTH,
  MIN_CHAT_PANEL_WIDTH,
} from '@shared/constants';

export interface AppStore {
  theme: 'light' | 'dark';
  chatPanelWidth: number;
  consoleVisible: boolean;
  setTheme: (theme: 'light' | 'dark') => void;
  setChatPanelWidth: (width: number) => void;
  toggleConsole: () => void;
  setConsoleVisible: (visible: boolean) => void;
}

export const useAppStore = create<AppStore>((set) => ({
  theme: 'light',
  chatPanelWidth: DEFAULT_CHAT_PANEL_WIDTH,
  consoleVisible: false,

  setTheme: (theme) => {
    set({ theme });
    document.documentElement.setAttribute('data-theme', theme);
  },

  setChatPanelWidth: (width) => {
    const clamped = Math.min(MAX_CHAT_PANEL_WIDTH, Math.max(MIN_CHAT_PANEL_WIDTH, width));
    set({ chatPanelWidth: clamped });
  },

  toggleConsole: () => set((state) => ({ consoleVisible: !state.consoleVisible })),

  setConsoleVisible: (visible) => set({ consoleVisible: visible }),
}));
