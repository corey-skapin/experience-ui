import type { Tab } from './tab.types';
import type { CLIState, Plugin } from './system.types';

export interface ApplicationState {
  tabs: Tab[];
  activeTabId: string | null;
  cliState: CLIState;
  plugins: Plugin[];
  theme: 'light' | 'dark';
  chatPanelWidth: number;
  consoleVisible: boolean;
}
