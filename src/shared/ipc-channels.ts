// src/shared/ipc-channels.ts
// Electron IPC channel name constants.
// Centralises all channel strings to prevent typos and enable IDE autocomplete.
//
// Full set of channels (cli, auth, proxy, versions, plugins, app domains)
// will be populated in T008 per contracts/electron-ipc-channels.md.

// ─── App domain ───────────────────────────────────────────────────────────────
export const IPC_APP_GET_VERSION = 'app:get-version' as const;
export const IPC_APP_COMPILE_CODE = 'app:compile-code' as const;
export const IPC_APP_VALIDATE_CODE = 'app:validate-code' as const;

// ─── Placeholder — full channel list in T008 ─────────────────────────────────
