// src/renderer/types/window.d.ts
// Renderer-side window augmentation: exposes the experienceUI IPC bridge.
// The full ExperienceUIBridge type is defined in src/main/preload-types.ts
// and exposed to the renderer via the contextBridge preload script.

import type { ExperienceUIBridge } from '../../main/preload-types';

declare global {
  interface Window {
    experienceUI: ExperienceUIBridge;
  }
}

export {};
