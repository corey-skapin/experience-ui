// src/sandbox/runtime.ts
// T037 — Minimal React 19 sandbox runtime.
// Listens for INIT message, executes bundled code, mounts to #root.
// This runs INSIDE the sandboxed iframe — no access to host DOM.

const SANDBOX_VERSION = '1.0.0';

// ─── Types ────────────────────────────────────────────────────────────────────

interface InitPayload {
  nonce: string;
  bundledCode: string;
  reactRuntimeUrl: string;
  theme: 'light' | 'dark';
  containerSize: { width: number; height: number };
}

interface InboundMessage {
  type: string;
  payload: InitPayload;
  nonce: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function postToHost(type: string, payload: unknown, nonce: string): void {
  // Security note: window.parent is used here intentionally — this IS the sandbox
  // runtime (trusted code, not user-generated), whose only purpose is to relay
  // messages back to the host iframe manager. The '*' target origin is necessary
  // because sandboxed iframes without allow-same-origin have an opaque origin,
  // making the host origin unknowable from within the sandbox. The host validates
  // nonces on every inbound message to prevent spoofing.

  window.parent.postMessage({ type, payload, nonce, timestamp: Date.now() }, '*');
}

function handleInit(payload: InitPayload, nonce: string): void {
  // Apply theme so sandbox-rendered components inherit the host theme.
  document.documentElement.setAttribute('data-theme', payload.theme ?? 'light');

  if (!payload.bundledCode) {
    postToHost('READY', { nonce, version: SANDBOX_VERSION }, nonce);
    return;
  }

  try {
    // Security boundary: bundledCode reaches this point only after passing
    // validateCode() in the renderer (which blocks all 13 disallowed patterns
    // per FR-034). The `new Function()` here is the sandboxed iframe's own
    // execution mechanism — it runs in an isolated browsing context with no
    // Node.js access, no same-origin privileges, and a strict CSP.
    // This use of `new Function()` is explicitly allowed for runtime.ts (not
    // user-generated code), and is the standard IIFE execution pattern for
    // compiled browser bundles.

    const execute = new Function(payload.bundledCode);
    execute();
  } catch (err) {
    postToHost(
      'ERROR',
      {
        message: err instanceof Error ? err.message : String(err),
        isFatal: true,
      },
      nonce,
    );
    return;
  }

  postToHost('READY', { nonce, version: SANDBOX_VERSION }, nonce);
}

// ─── Runtime Entry ────────────────────────────────────────────────────────────

/**
 * Bootstraps the sandbox message listener.
 * Called once from the sandbox's index.html entry point.
 *
 * Security contract:
 *  - Only reacts to INIT messages.
 *  - Validates that the outer nonce matches payload.nonce before executing.
 *  - All outbound messages carry the same nonce for host verification.
 */
export function initRuntime(): void {
  window.addEventListener('message', (event: MessageEvent) => {
    if (event.data === null || typeof event.data !== 'object') return;

    const { type, payload, nonce } = event.data as InboundMessage;
    if (type !== 'INIT') return;

    // Nonce double-check: outer envelope must match payload nonce.
    if (!nonce || !payload?.nonce || nonce !== payload.nonce) return;

    handleInit(payload, nonce);
  });
}
