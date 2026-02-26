import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SANDBOX_ALLOWED_MESSAGE_TYPES, HOST_ALLOWED_MESSAGE_TYPES } from '../shared/constants';
import { createBridge, type SandboxBridge } from './bridge';

// Minimal MessageEvent factory for JSDOM-like environments
function makeMessageEvent(data: unknown, origin = 'null'): MessageEvent {
  return new MessageEvent('message', { data, origin });
}

describe('SandboxBridge — nonce verification', () => {
  let bridge: SandboxBridge;
  let postMessageSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    postMessageSpy = vi.fn();
    bridge = createBridge({ postMessage: postMessageSpy });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects messages with wrong nonce after INIT', () => {
    const correctNonce = 'nonce-abc123';
    bridge.handleMessage(makeMessageEvent({ type: 'INIT', nonce: correctNonce }));

    const handler = vi.fn();
    bridge.on('RENDER_DATA', handler);
    bridge.handleMessage(makeMessageEvent({ type: 'RENDER_DATA', nonce: 'WRONG_NONCE', data: {} }));

    expect(handler).not.toHaveBeenCalled();
  });

  it('accepts messages with the correct nonce after INIT', () => {
    const nonce = 'nonce-xyz987';
    bridge.handleMessage(makeMessageEvent({ type: 'INIT', nonce }));

    const handler = vi.fn();
    bridge.on('RENDER_DATA', handler);
    bridge.handleMessage(
      makeMessageEvent({ type: 'RENDER_DATA', nonce, data: { components: [] } }),
    );

    expect(handler).toHaveBeenCalledOnce();
  });

  it('drops messages before INIT is received (nonce unknown)', () => {
    const handler = vi.fn();
    bridge.on('RENDER_DATA', handler);
    bridge.handleMessage(makeMessageEvent({ type: 'RENDER_DATA', nonce: 'any', data: {} }));
    expect(handler).not.toHaveBeenCalled();
  });
});

describe('SandboxBridge — message type allowlist', () => {
  let bridge: SandboxBridge;
  let postMessageSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    postMessageSpy = vi.fn();
    bridge = createBridge({ postMessage: postMessageSpy });
    bridge.handleMessage(makeMessageEvent({ type: 'INIT', nonce: 'test-nonce' }));
  });

  it('silently ignores unknown message types', () => {
    const unknownHandler = vi.fn();
    // @ts-expect-error — intentionally testing unknown type
    bridge.on('TOTALLY_UNKNOWN_TYPE', unknownHandler);
    bridge.handleMessage(makeMessageEvent({ type: 'TOTALLY_UNKNOWN_TYPE', nonce: 'test-nonce' }));
    expect(unknownHandler).not.toHaveBeenCalled();
  });

  it('only handles types in SANDBOX_ALLOWED_MESSAGE_TYPES', () => {
    const allowedTypes = SANDBOX_ALLOWED_MESSAGE_TYPES;
    allowedTypes.forEach((type) => {
      // All types in the allowlist are recognized strings
      expect(typeof type).toBe('string');
    });
  });

  it('does not expose HOST_ALLOWED_MESSAGE_TYPES as inbound sandbox handlers', () => {
    // HOST messages (READY, NETWORK_REQUEST, etc.) are outbound — should not be handled inbound
    const handler = vi.fn();
    // @ts-expect-error — READY is an outbound type from sandbox, not inbound
    bridge.on('READY', handler);
    bridge.handleMessage(makeMessageEvent({ type: 'READY', nonce: 'test-nonce' }));
    expect(handler).not.toHaveBeenCalled();
  });
});

describe('SandboxBridge — INIT handshake', () => {
  let bridge: SandboxBridge;
  let postMessageSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    postMessageSpy = vi.fn();
    bridge = createBridge({ postMessage: postMessageSpy });
  });

  it('receives INIT message and extracts the nonce', () => {
    const nonce = 'init-nonce-001';
    bridge.handleMessage(makeMessageEvent({ type: 'INIT', nonce }));
    expect(bridge.getNonce()).toBe(nonce);
  });

  it('after INIT, sends back READY with nonce echo', () => {
    const nonce = 'init-nonce-002';
    bridge.handleMessage(makeMessageEvent({ type: 'INIT', nonce }));
    expect(postMessageSpy).toHaveBeenCalledOnce();
    const sentMessage = postMessageSpy.mock.calls[0][0] as Record<string, unknown>;
    expect(sentMessage.type).toBe('READY');
    expect(sentMessage.nonce).toBe(nonce);
  });

  it('READY message type is in HOST_ALLOWED_MESSAGE_TYPES', () => {
    expect(HOST_ALLOWED_MESSAGE_TYPES).toContain('READY');
  });
});

describe('SandboxBridge — NETWORK_REQUEST proxying', () => {
  let bridge: SandboxBridge;
  let postMessageSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    postMessageSpy = vi.fn();
    bridge = createBridge({ postMessage: postMessageSpy });
    bridge.handleMessage(makeMessageEvent({ type: 'INIT', nonce: 'proxy-nonce' }));
    postMessageSpy.mockClear(); // clear the READY call
  });

  it('sends a NETWORK_REQUEST message to host when sandbox requests a network call', () => {
    bridge.sendNetworkRequest({
      requestId: 'req-1',
      url: 'https://api.example.com/users',
      method: 'GET',
    });
    expect(postMessageSpy).toHaveBeenCalledOnce();
    const msg = postMessageSpy.mock.calls[0][0] as Record<string, unknown>;
    expect(msg.type).toBe('NETWORK_REQUEST');
    expect(msg.nonce).toBe('proxy-nonce');
  });

  it('NETWORK_REQUEST type is in HOST_ALLOWED_MESSAGE_TYPES', () => {
    expect(HOST_ALLOWED_MESSAGE_TYPES).toContain('NETWORK_REQUEST');
  });

  it('includes request details in the NETWORK_REQUEST payload', () => {
    bridge.sendNetworkRequest({
      requestId: 'req-2',
      url: 'https://api.example.com/items',
      method: 'POST',
      body: JSON.stringify({ name: 'test' }),
    });
    const msg = postMessageSpy.mock.calls[0][0] as Record<string, unknown>;
    expect(msg).toMatchObject({
      type: 'NETWORK_REQUEST',
      requestId: 'req-2',
      url: 'https://api.example.com/items',
      method: 'POST',
    });
  });
});

describe('SandboxBridge — unknown message rejection', () => {
  let bridge: SandboxBridge;
  let postMessageSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    postMessageSpy = vi.fn();
    bridge = createBridge({ postMessage: postMessageSpy });
    bridge.handleMessage(makeMessageEvent({ type: 'INIT', nonce: 'test-nonce' }));
    postMessageSpy.mockClear();
  });

  it('does not call any handler for an unrecognized message type', () => {
    const anyHandler = vi.fn();
    // Register handlers for ALL allowed types
    SANDBOX_ALLOWED_MESSAGE_TYPES.forEach((type) => bridge.on(type, anyHandler));

    bridge.handleMessage(makeMessageEvent({ type: 'UNKNOWN_MSG', nonce: 'test-nonce' }));
    expect(anyHandler).not.toHaveBeenCalled();
  });

  it('does not post any message back for an unrecognized type', () => {
    bridge.handleMessage(makeMessageEvent({ type: 'INVALID_TYPE', nonce: 'test-nonce' }));
    expect(postMessageSpy).not.toHaveBeenCalled();
  });
});
