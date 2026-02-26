import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAppStore } from '@/stores/app-store';
import {
  DEFAULT_CHAT_PANEL_WIDTH,
  MAX_CHAT_PANEL_WIDTH,
  MIN_CHAT_PANEL_WIDTH,
} from '@shared/constants';

// Mock document.documentElement.setAttribute for setTheme tests
beforeEach(() => {
  // Reset store state before each test
  useAppStore.setState({
    theme: 'light',
    chatPanelWidth: DEFAULT_CHAT_PANEL_WIDTH,
    consoleVisible: false,
  });
});

describe('App Store', () => {
  describe('Initial state', () => {
    it('has light theme by default', () => {
      const { theme } = useAppStore.getState();
      expect(theme).toBe('light');
    });

    it('has default chat panel width', () => {
      const { chatPanelWidth } = useAppStore.getState();
      expect(chatPanelWidth).toBe(DEFAULT_CHAT_PANEL_WIDTH);
    });

    it('has console hidden by default', () => {
      const { consoleVisible } = useAppStore.getState();
      expect(consoleVisible).toBe(false);
    });
  });

  describe('setTheme', () => {
    it('sets theme to dark', () => {
      const setAttribute = vi.spyOn(document.documentElement, 'setAttribute');
      useAppStore.getState().setTheme('dark');
      expect(useAppStore.getState().theme).toBe('dark');
      expect(setAttribute).toHaveBeenCalledWith('data-theme', 'dark');
    });

    it('sets theme to light', () => {
      const setAttribute = vi.spyOn(document.documentElement, 'setAttribute');
      useAppStore.getState().setTheme('light');
      expect(useAppStore.getState().theme).toBe('light');
      expect(setAttribute).toHaveBeenCalledWith('data-theme', 'light');
    });
  });

  describe('setChatPanelWidth', () => {
    it('sets width within valid range', () => {
      useAppStore.getState().setChatPanelWidth(50);
      expect(useAppStore.getState().chatPanelWidth).toBe(50);
    });

    it('clamps width to minimum', () => {
      useAppStore.getState().setChatPanelWidth(5); // below MIN_CHAT_PANEL_WIDTH
      expect(useAppStore.getState().chatPanelWidth).toBe(MIN_CHAT_PANEL_WIDTH);
    });

    it('clamps width to maximum', () => {
      useAppStore.getState().setChatPanelWidth(95); // above MAX_CHAT_PANEL_WIDTH
      expect(useAppStore.getState().chatPanelWidth).toBe(MAX_CHAT_PANEL_WIDTH);
    });

    it('accepts exactly the minimum value', () => {
      useAppStore.getState().setChatPanelWidth(MIN_CHAT_PANEL_WIDTH);
      expect(useAppStore.getState().chatPanelWidth).toBe(MIN_CHAT_PANEL_WIDTH);
    });

    it('accepts exactly the maximum value', () => {
      useAppStore.getState().setChatPanelWidth(MAX_CHAT_PANEL_WIDTH);
      expect(useAppStore.getState().chatPanelWidth).toBe(MAX_CHAT_PANEL_WIDTH);
    });
  });

  describe('toggleConsole', () => {
    it('toggles console from false to true', () => {
      useAppStore.getState().toggleConsole();
      expect(useAppStore.getState().consoleVisible).toBe(true);
    });

    it('toggles console from true to false', () => {
      useAppStore.setState({ consoleVisible: true });
      useAppStore.getState().toggleConsole();
      expect(useAppStore.getState().consoleVisible).toBe(false);
    });

    it('can toggle multiple times', () => {
      useAppStore.getState().toggleConsole(); // false → true
      useAppStore.getState().toggleConsole(); // true → false
      useAppStore.getState().toggleConsole(); // false → true
      expect(useAppStore.getState().consoleVisible).toBe(true);
    });
  });

  describe('setConsoleVisible', () => {
    it('sets console visible to true', () => {
      useAppStore.getState().setConsoleVisible(true);
      expect(useAppStore.getState().consoleVisible).toBe(true);
    });

    it('sets console visible to false', () => {
      useAppStore.setState({ consoleVisible: true });
      useAppStore.getState().setConsoleVisible(false);
      expect(useAppStore.getState().consoleVisible).toBe(false);
    });
  });
});
