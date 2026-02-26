// src/sandbox/bridge.test.ts
// T020 — Unit tests for the sandbox postMessage bridge.
// Tests are written RED-first: the implementation does not exist yet.
// Covers: nonce verification, message type allowlist, INIT handshake,
//         NETWORK_REQUEST proxying, READY echo, unknown message rejection.

import { describe, it, expect, vi, beforeEach } from 'vitest';

import { initBridge } from './bridge';
import { SANDBOX_ALLOWED_HOST_MESSAGE_TYPES } from '../shared/constants';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Build a minimal postMessage event from the host → sandbox direction. */
function makeHostEvent(
  type: string,
  payload: unknown,
  nonce: string,
  origin = 'null',
): MessageEvent {
  return new MessageEvent('message', {
    data: { type, payload, nonce, timestamp: Date.now() },
    origin,
  });
}

/** Capture postMessage calls made by the sandbox back to the host. */
function captureHostMessages(): { messages: unknown[]; restore: () => void } {
  const messages: unknown[] = [];
  const originalPostMessage = window.parent.postMessage.bind(window.parent);
  window.parent.postMessage = vi.fn((msg: unknown) => {
    messages.push(msg);
  });
  return {
    messages,
    restore: () => {
      window.parent.postMessage = originalPostMessage;
    },
  };
}

// ─── Setup / Teardown ────────────────────────────────────────────────────────

const TEST_NONCE = 'test-nonce-abc123';
const HOST_ORIGIN = 'null';

beforeEach(() => {
  // Remove all message event listeners between tests
  vi.restoreAllMocks();
});

// ─── Nonce Verification ───────────────────────────────────────────────────────

describe('nonce verification', () => {
  it('rejects INIT message with wrong nonce (does not emit READY)', () => {
    const { messages, restore } = captureHostMessages();
    initBridge(HOST_ORIGIN, TEST_NONCE);

    const event = makeHostEvent(
      'INIT',
      {
        nonce: 'wrong-nonce',
        bundledCode: '',
        reactRuntimeUrl: '',
        theme: 'light',
        containerSize: { width: 800, height: 600 },
      },
      'wrong-nonce',
    );
    window.dispatchEvent(event);

    const readyMessages = messages.filter((m) => (m as { type?: string }).type === 'READY');
    expect(readyMessages).toHaveLength(0);
    restore();
  });

  it('accepts INIT message with correct nonce and emits READY', () => {
    const { messages, restore } = captureHostMessages();
    initBridge(HOST_ORIGIN, TEST_NONCE);

    const event = makeHostEvent(
      'INIT',
      {
        nonce: TEST_NONCE,
        bundledCode: '',
        reactRuntimeUrl: '',
        theme: 'light',
        containerSize: { width: 800, height: 600 },
      },
      TEST_NONCE,
    );
    window.dispatchEvent(event);

    const readyMessages = messages.filter((m) => (m as { type?: string }).type === 'READY');
    expect(readyMessages).toHaveLength(1);
    restore();
  });

  it('ignores messages from unexpected origins even with correct nonce', () => {
    const { messages, restore } = captureHostMessages();
    initBridge(HOST_ORIGIN, TEST_NONCE);

    // Sandboxed iframes without allow-same-origin always have origin 'null'.
    // A message claiming to come from https://attacker.com should be rejected.
    const event = makeHostEvent('INIT', { nonce: TEST_NONCE }, TEST_NONCE, 'https://attacker.com');
    window.dispatchEvent(event);

    expect(messages).toHaveLength(0);
    restore();
  });

  it('rejects messages with missing nonce field', () => {
    const { messages, restore } = captureHostMessages();
    initBridge(HOST_ORIGIN, TEST_NONCE);

    const event = new MessageEvent('message', {
      data: { type: 'INIT', payload: {} },
      origin: HOST_ORIGIN,
    });
    window.dispatchEvent(event);

    expect(messages.filter((m) => (m as { type?: string }).type === 'READY')).toHaveLength(0);
    restore();
  });
});

// ─── Message Type Allowlist ───────────────────────────────────────────────────

describe('message type allowlist', () => {
  it('rejects unknown message types silently (no reply)', () => {
    const { messages, restore } = captureHostMessages();
    initBridge(HOST_ORIGIN, TEST_NONCE);

    const event = makeHostEvent('EXECUTE_SCRIPT', { code: 'alert(1)' }, TEST_NONCE);
    window.dispatchEvent(event);

    expect(messages).toHaveLength(0);
    restore();
  });

  it('rejects HACK type message silently', () => {
    const { messages, restore } = captureHostMessages();
    initBridge(HOST_ORIGIN, TEST_NONCE);

    const event = makeHostEvent('HACK', {}, TEST_NONCE);
    window.dispatchEvent(event);

    expect(messages).toHaveLength(0);
    restore();
  });

  it('accepts all SANDBOX_ALLOWED_HOST_MESSAGE_TYPES without throwing', () => {
    // Each allowed type should be processed without error
    for (const type of SANDBOX_ALLOWED_HOST_MESSAGE_TYPES) {
      expect(() => {
        initBridge(HOST_ORIGIN, TEST_NONCE);
        const event = makeHostEvent(type, {}, TEST_NONCE);
        window.dispatchEvent(event);
      }).not.toThrow();
    }
  });

  it('does not process HOST_ALLOWED_SANDBOX_MESSAGE_TYPES (those are outbound, not inbound)', () => {
    // The sandbox should NOT accept messages of type READY, LOG, etc. (those are sandbox→host)
    const { messages, restore } = captureHostMessages();
    initBridge(HOST_ORIGIN, TEST_NONCE);

    // RENDER_COMPLETE is sandbox→host, not host→sandbox; should be silently ignored
    const event = makeHostEvent(
      'RENDER_COMPLETE',
      { componentCount: 1, renderTimeMs: 100 },
      TEST_NONCE,
    );
    window.dispatchEvent(event);

    expect(messages).toHaveLength(0);
    restore();
  });
});

// ─── INIT Handshake ───────────────────────────────────────────────────────────

describe('INIT handshake', () => {
  it('responds to INIT with READY message containing echoed nonce', () => {
    const { messages, restore } = captureHostMessages();
    initBridge(HOST_ORIGIN, TEST_NONCE);

    const event = makeHostEvent(
      'INIT',
      {
        nonce: TEST_NONCE,
        bundledCode: '',
        reactRuntimeUrl: '',
        theme: 'light',
        containerSize: { width: 800, height: 600 },
      },
      TEST_NONCE,
    );
    window.dispatchEvent(event);

    const ready = messages.find((m) => (m as { type?: string }).type === 'READY') as
      | {
          type: string;
          payload: { nonce: string; version: string };
        }
      | undefined;
    expect(ready).toBeDefined();
    expect(ready?.payload.nonce).toBe(TEST_NONCE);
    restore();
  });

  it('READY response includes a version string', () => {
    const { messages, restore } = captureHostMessages();
    initBridge(HOST_ORIGIN, TEST_NONCE);

    const event = makeHostEvent(
      'INIT',
      {
        nonce: TEST_NONCE,
        bundledCode: '',
        reactRuntimeUrl: '',
        theme: 'light',
        containerSize: { width: 800, height: 600 },
      },
      TEST_NONCE,
    );
    window.dispatchEvent(event);

    const ready = messages.find((m) => (m as { type?: string }).type === 'READY') as
      | {
          payload: { version: string };
        }
      | undefined;
    expect(typeof ready?.payload.version).toBe('string');
    expect(ready?.payload.version.length).toBeGreaterThan(0);
    restore();
  });

  it('READY message includes a nonce field for host verification', () => {
    const { messages, restore } = captureHostMessages();
    initBridge(HOST_ORIGIN, TEST_NONCE);

    const event = makeHostEvent(
      'INIT',
      {
        nonce: TEST_NONCE,
        bundledCode: '',
        reactRuntimeUrl: '',
        theme: 'light',
        containerSize: { width: 800, height: 600 },
      },
      TEST_NONCE,
    );
    window.dispatchEvent(event);

    const ready = messages.find((m) => (m as { type?: string }).type === 'READY') as
      | {
          nonce: string;
        }
      | undefined;
    // nonce on the envelope or in payload — either is acceptable
    const hasNonce =
      ready?.nonce === TEST_NONCE ||
      (ready as unknown as { payload: { nonce: string } })?.payload?.nonce === TEST_NONCE;
    expect(hasNonce).toBe(true);
    restore();
  });
});

// ─── NETWORK_REQUEST Proxying ─────────────────────────────────────────────────

describe('NETWORK_REQUEST proxying', () => {
  it('forwards NETWORK_REQUEST to host via postMessage', () => {
    const { messages, restore } = captureHostMessages();
    initBridge(HOST_ORIGIN, TEST_NONCE);

    // First complete the handshake so the nonce is established
    window.dispatchEvent(
      makeHostEvent(
        'INIT',
        {
          nonce: TEST_NONCE,
          bundledCode: '',
          reactRuntimeUrl: '',
          theme: 'light',
          containerSize: { width: 800, height: 600 },
        },
        TEST_NONCE,
      ),
    );

    // Simulate sandbox-internal code dispatching a network request event
    const networkEvent = new CustomEvent('bridge:network-request', {
      detail: {
        requestId: 'req-001',
        url: 'https://api.example.com/pets',
        method: 'GET',
        headers: {},
      },
    });
    window.dispatchEvent(networkEvent);

    const netRequest = messages.find((m) => (m as { type?: string }).type === 'NETWORK_REQUEST') as
      | { type: string; payload: { requestId: string; url: string } }
      | undefined;
    expect(netRequest).toBeDefined();
    expect(netRequest?.payload.requestId).toBe('req-001');
    expect(netRequest?.payload.url).toBe('https://api.example.com/pets');
    restore();
  });

  it('passes NETWORK_RESPONSE back into the sandbox via message event', () => {
    // After INIT, the host may send NETWORK_RESPONSE; it should be processed without error
    initBridge(HOST_ORIGIN, TEST_NONCE);

    // Complete handshake
    window.dispatchEvent(
      makeHostEvent(
        'INIT',
        {
          nonce: TEST_NONCE,
          bundledCode: '',
          reactRuntimeUrl: '',
          theme: 'light',
          containerSize: { width: 800, height: 600 },
        },
        TEST_NONCE,
      ),
    );

    // Dispatch NETWORK_RESPONSE — should not throw
    expect(() => {
      window.dispatchEvent(
        makeHostEvent(
          'NETWORK_RESPONSE',
          {
            requestId: 'req-001',
            status: 200,
            statusText: 'OK',
            headers: {},
            body: '{}',
            ok: true,
          },
          TEST_NONCE,
        ),
      );
    }).not.toThrow();
  });
});

// ─── Unknown Message Rejection ─────────────────────────────────────────────────

describe('unknown message rejection', () => {
  it('does not throw when an unknown message type is received', () => {
    initBridge(HOST_ORIGIN, TEST_NONCE);
    expect(() => {
      window.dispatchEvent(makeHostEvent('TOTALLY_UNKNOWN_TYPE', {}, TEST_NONCE));
    }).not.toThrow();
  });

  it('produces no outbound messages for unknown types', () => {
    const { messages, restore } = captureHostMessages();
    initBridge(HOST_ORIGIN, TEST_NONCE);

    window.dispatchEvent(makeHostEvent('UNKNOWN_TYPE_XYZ', {}, TEST_NONCE));
    expect(messages).toHaveLength(0);
    restore();
  });

  it('handles null data gracefully', () => {
    initBridge(HOST_ORIGIN, TEST_NONCE);
    expect(() => {
      window.dispatchEvent(new MessageEvent('message', { data: null, origin: HOST_ORIGIN }));
    }).not.toThrow();
  });

  it('handles non-object data gracefully', () => {
    initBridge(HOST_ORIGIN, TEST_NONCE);
    expect(() => {
      window.dispatchEvent(
        new MessageEvent('message', { data: 'raw string', origin: HOST_ORIGIN }),
      );
    }).not.toThrow();
  });
});
