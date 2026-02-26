// src/sandbox/bridge.ts
// T037 — Sandbox postMessage bridge.
// Runs inside the sandboxed iframe. Handles controlled communication
// with the host renderer per contracts/sandbox-postmessage-api.md.
//
// Security model:
//  - Verifies event.origin matches the hostOrigin supplied at init
//  - Verifies message nonce matches the session nonce
//  - Only processes SANDBOX_ALLOWED_HOST_MESSAGE_TYPES
//  - Sends outbound messages via window.parent.postMessage

import { SANDBOX_ALLOWED_HOST_MESSAGE_TYPES } from '../shared/constants';

// ─── Constants ────────────────────────────────────────────────────────────────

const SANDBOX_VERSION = '1.0.0';

// ─── Module-level listener handles (for cleanup on re-init) ──────────────────

let _messageHandler: ((e: MessageEvent) => void) | null = null;
let _networkHandler: ((e: Event) => void) | null = null;

// ─── Bridge ───────────────────────────────────────────────────────────────────

/**
 * Initialize the sandbox postMessage bridge.
 *
 * @param hostOrigin - Expected origin of host messages ('null' for sandboxed iframes).
 * @param nonce      - Session nonce; all incoming messages must carry this nonce.
 */
export function initBridge(hostOrigin: string, nonce: string): void {
  // Remove any previously registered listeners so re-init is idempotent
  if (_messageHandler !== null) {
    window.removeEventListener('message', _messageHandler);
  }
  if (_networkHandler !== null) {
    window.removeEventListener('bridge:network-request', _networkHandler);
  }

  // ── Inbound: messages from host ────────────────────────────────────────────

  _messageHandler = (event: MessageEvent): void => {
    // 1. Origin check
    if (event.origin !== hostOrigin) return;

    // 2. Data shape check
    if (event.data === null || typeof event.data !== 'object') return;

    const msg = event.data as Record<string, unknown>;
    const type = msg['type'];
    const msgNonce = msg['nonce'];

    // 3. Nonce check
    if (msgNonce !== nonce) return;

    // 4. Allowlist check
    const allowedTypes: readonly string[] = SANDBOX_ALLOWED_HOST_MESSAGE_TYPES;
    if (typeof type !== 'string' || !allowedTypes.includes(type)) return;

    // 5. Handle message
    switch (type) {
      case 'INIT':
        sendToHost({
          type: 'READY',
          payload: { nonce, version: SANDBOX_VERSION },
          nonce,
          timestamp: Date.now(),
        });
        break;

      // RENDER_DATA, THEME_CHANGE, RESIZE, NETWORK_RESPONSE, DESTROY
      // are handled by the runtime layer; bridge just validates and passes through.
      default:
        break;
    }
  };

  // ── Outbound: network requests from generated code ─────────────────────────

  _networkHandler = (e: Event): void => {
    const { detail } = e as CustomEvent<{
      requestId: string;
      url: string;
      method?: string;
      headers?: Record<string, string>;
      body?: string;
    }>;

    sendToHost({
      type: 'NETWORK_REQUEST',
      payload: {
        requestId: detail.requestId,
        url: detail.url,
        method: detail.method ?? 'GET',
        headers: detail.headers ?? {},
        body: detail.body,
      },
      nonce,
      timestamp: Date.now(),
    });
  };

  window.addEventListener('message', _messageHandler);
  window.addEventListener('bridge:network-request', _networkHandler);
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function sendToHost(message: unknown): void {
  // Security note: '*' is required for outbound messages from a sandboxed iframe.
  // Sandboxed iframes without 'allow-same-origin' have an opaque origin, so
  // the host origin is not knowable at this point. The host validates the nonce
  // on every received message, so spoofing requires possession of the per-session
  // nonce (which is only shared with the legitimate host via the INIT message).

  window.parent.postMessage(message, '*');
}
