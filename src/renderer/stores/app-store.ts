/**
 * Zustand app-level store for global UI state.
 * Manages theme, chat panel layout, and console visibility.
 */
import { create } from 'zustand'
import { LAYOUT } from '../../shared/constants'

export type Theme = 'light' | 'dark'

export interface AppState {
  /** Active color theme. Defaults to 'light'. */
  theme: Theme
  /** Chat panel width as a percentage of the window width. */
  chatPanelWidth: number
  /** Whether the debug console panel is visible. */
  consoleVisible: boolean

  // ─── Actions ─────────────────────────────────────────────────────────

  setTheme: (theme: Theme) => void
  toggleTheme: () => void
  setChatPanelWidth: (width: number) => void
  setConsoleVisible: (visible: boolean) => void
  toggleConsole: () => void
}

export const useAppStore = create<AppState>((set) => ({
  theme: 'light',
  chatPanelWidth: LAYOUT.DEFAULT_CHAT_PANEL_RATIO,
  consoleVisible: false,

  setTheme: (theme) => set({ theme }),

  toggleTheme: () => set((state) => ({ theme: state.theme === 'light' ? 'dark' : 'light' })),

  setChatPanelWidth: (width) =>
    set({
      chatPanelWidth: Math.min(
        LAYOUT.MAX_CHAT_PANEL_WIDTH_PERCENT,
        Math.max(LAYOUT.MIN_CHAT_PANEL_WIDTH_PERCENT, width),
      ),
    }),

  setConsoleVisible: (visible) => set({ consoleVisible: visible }),

  toggleConsole: () => set((state) => ({ consoleVisible: !state.consoleVisible })),
}))
