// src/main/preload.ts
// Preload script — runs in renderer context but has access to Node.js APIs.
// Exposes a typed, minimal IPC surface via contextBridge.exposeInMainWorld.
//
// The full ExperienceUIBridge interface (covering cli, auth, proxy, versions,
// plugins, and app domains) will be implemented in T011. This placeholder
// establishes the module with a typed stub so TypeScript compilation succeeds.
import { contextBridge, ipcRenderer } from 'electron';

// Minimal typed stub — full implementation in T011
const bridge = {
  // App domain
  app: {
    getVersion: (): Promise<string> => ipcRenderer.invoke('app:get-version'),
  },
} as const;

export type ExperienceUIBridge = typeof bridge;

contextBridge.exposeInMainWorld('experienceUI', bridge);
