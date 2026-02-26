export type SandboxStatus = 'idle' | 'loading' | 'active' | 'error';

export type SandboxState =
  | { status: 'idle' }
  | { status: 'loading'; progress: number }
  | { status: 'active'; iframeRef: string }
  | { status: 'error'; error: string; lastSafeVersionId: string };

export interface InterfaceVersion {
  id: string;
  interfaceId: string;
  versionNumber: number;
  parentVersionId: string | null;
  changeType: 'generation' | 'customization' | 'rollback';
  description: string;
  generationPrompt: string | null;
  codePath: string;
  codeHash: string;
  isRevert: boolean;
  revertedFromVersionId: string | null;
  pluginDependencies?: string[];
  createdAt: string;
}

export interface GeneratedInterface {
  id: string;
  tabId: string;
  apiSpecId: string;
  currentVersionId: string;
  versions: InterfaceVersion[];
  sandboxState: SandboxState;
  createdAt: string;
}
