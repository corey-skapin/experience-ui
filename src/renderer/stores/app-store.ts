// src/renderer/stores/app-store.ts
// Zustand store for application-level state (T015).
// Manages theme, chatPanelWidth, and consoleVisible.
// Per data-model.md ApplicationState.
import { create } from 'zustand';

import {
  DEFAULT_CHAT_PANEL_WIDTH_PERCENT,
  MAX_CHAT_PANEL_WIDTH_PERCENT,
  MIN_CHAT_PANEL_WIDTH_PERCENT,
} from '../../shared/constants';

// ─── State Shape ──────────────────────────────────────────────────────────────

interface AppState {
  /** Active color theme */
  theme: 'light' | 'dark';

  /**
   * Chat panel width as a percentage of total layout width.
   * Range: MIN_CHAT_PANEL_WIDTH_PERCENT (15) to MAX_CHAT_PANEL_WIDTH_PERCENT (85).
   * Default: DEFAULT_CHAT_PANEL_WIDTH_PERCENT (30).
   */
  chatPanelWidth: number;

  /** Whether the debug console panel is visible */
  consoleVisible: boolean;
}

// ─── Actions ──────────────────────────────────────────────────────────────────

interface AppActions {
  setTheme(theme: 'light' | 'dark'): void;
  toggleTheme(): void;
  setChatPanelWidth(width: number): void;
  toggleConsole(): void;
  setConsoleVisible(visible: boolean): void;
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useAppStore = create<AppState & AppActions>()((set) => ({
  // ── Initial State ─────────────────────────────────────────────────────────
  theme: 'dark',
  chatPanelWidth: DEFAULT_CHAT_PANEL_WIDTH_PERCENT,
  consoleVisible: false,

  // ── Actions ───────────────────────────────────────────────────────────────
  setTheme: (theme) => set({ theme }),

  toggleTheme: () =>
    set((state) => ({ theme: state.theme === 'light' ? 'dark' : 'light' })),

  setChatPanelWidth: (width) =>
    set({
      chatPanelWidth: Math.min(
        MAX_CHAT_PANEL_WIDTH_PERCENT,
        Math.max(MIN_CHAT_PANEL_WIDTH_PERCENT, width),
      ),
    }),

  toggleConsole: () => set((state) => ({ consoleVisible: !state.consoleVisible })),

  setConsoleVisible: (visible) => set({ consoleVisible: visible }),
}));

// ─── Selectors ────────────────────────────────────────────────────────────────

export const selectTheme = (state: AppState): AppState['theme'] => state.theme;
export const selectChatPanelWidth = (state: AppState): number => state.chatPanelWidth;
export const selectConsoleVisible = (state: AppState): boolean => state.consoleVisible;
