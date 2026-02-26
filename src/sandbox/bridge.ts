// src/sandbox/bridge.ts
// Sandbox postMessage bridge — runs inside the sandboxed iframe.
// Handles the controlled communication protocol between the host renderer
// and the sandbox (defined in contracts/sandbox-postmessage-api.md).
//
// Full implementation in T037. This placeholder establishes the module
// for TypeScript compilation.

/** Placeholder — full postMessage bridge implementation in T037. */
export function initBridge(_hostOrigin: string, _nonce: string): void {
  // TODO: T037 — implement nonce verification, message type allowlist,
  // INIT/READY handshake, NETWORK_REQUEST proxying
}
