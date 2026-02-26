import { create } from 'zustand';
import type { CLIState } from '../../shared/types';

interface CLIStoreState extends CLIState {
  setStatus: (state: CLIState) => void;
}

export const useCliStore = create<CLIStoreState>((set) => {
  const initialState: CLIState = {
    status: 'stopped',
    pid: null,
    lastCrashAt: null,
    restartCount: 0,
    pendingRequests: 0,
    errorMessage: null,
  };

  // Subscribe to push notifications from the main process
  if (typeof window !== 'undefined' && window.experienceUI?.cli?.onStatusChanged) {
    window.experienceUI.cli.onStatusChanged((event: unknown) => {
      set({
        ...(event as CLIState),
        setStatus: undefined as unknown as CLIStoreState['setStatus'],
      });
    });
  }

  return {
    ...initialState,
    setStatus: (state: CLIState) => set({ ...state }),
  };
});
