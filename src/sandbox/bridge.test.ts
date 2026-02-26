/**
 * Unit tests for the sandbox postMessage bridge.
 * Tests nonce verification, message type allowlist filtering,
 * INIT handshake, NETWORK_REQUEST proxying, READY echo,
 * and unknown message rejection.
 *
 * Tests are written FIRST (TDD) and MUST fail before implementation exists.
 * Note: bridge.ts runs in browser context; we test its logic via exported functions.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  createBridge,
  type BridgeInstance,
  HOST_ALLOWED_TYPES,
  SANDBOX_ALLOWED_TYPES,
} from './bridge'

// ─── Allowlist constants ──────────────────────────────────────────────────

describe('message type allowlists', () => {
  it('HOST_ALLOWED_TYPES contains expected sandbox→host types', () => {
    expect(HOST_ALLOWED_TYPES).toContain('READY')
    expect(HOST_ALLOWED_TYPES).toContain('RENDER_COMPLETE')
    expect(HOST_ALLOWED_TYPES).toContain('NETWORK_REQUEST')
    expect(HOST_ALLOWED_TYPES).toContain('LOG')
    expect(HOST_ALLOWED_TYPES).toContain('ERROR')
    expect(HOST_ALLOWED_TYPES).toContain('UI_EVENT')
  })

  it('SANDBOX_ALLOWED_TYPES contains expected host→sandbox types', () => {
    expect(SANDBOX_ALLOWED_TYPES).toContain('INIT')
    expect(SANDBOX_ALLOWED_TYPES).toContain('RENDER_DATA')
    expect(SANDBOX_ALLOWED_TYPES).toContain('THEME_CHANGE')
    expect(SANDBOX_ALLOWED_TYPES).toContain('RESIZE')
    expect(SANDBOX_ALLOWED_TYPES).toContain('NETWORK_RESPONSE')
    expect(SANDBOX_ALLOWED_TYPES).toContain('DESTROY')
  })
})

// ─── Bridge instance ──────────────────────────────────────────────────────

describe('createBridge', () => {
  let mockParent: { postMessage: ReturnType<typeof vi.fn> }
  let bridge: BridgeInstance
  const TEST_NONCE = 'test-nonce-12345'

  beforeEach(() => {
    mockParent = { postMessage: vi.fn() }
    bridge = createBridge({ parent: mockParent as unknown as Window })
  })

  // ─── INIT handshake ───────────────────────────────────────────────────

  describe('INIT handshake', () => {
    it('stores nonce from INIT message', () => {
      bridge.handleMessage({
        source: mockParent,
        origin: 'null',
        data: { type: 'INIT', nonce: TEST_NONCE, payload: {} },
      } as unknown as MessageEvent)

      expect(bridge.getNonce()).toBe(TEST_NONCE)
    })

    it('sends READY after INIT', () => {
      bridge.handleMessage({
        source: mockParent,
        origin: 'null',
        data: { type: 'INIT', nonce: TEST_NONCE, payload: {} },
      } as unknown as MessageEvent)

      expect(mockParent.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'READY' }),
        'null',
      )
    })

    it('echoes nonce in READY response', () => {
      bridge.handleMessage({
        source: mockParent,
        origin: 'null',
        data: { type: 'INIT', nonce: TEST_NONCE, payload: {} },
      } as unknown as MessageEvent)

      const call = mockParent.postMessage.mock.calls[0] as [
        { type: string; payload: { nonce: string } },
        string,
      ]
      expect(call[0].payload.nonce).toBe(TEST_NONCE)
    })
  })

  // ─── Nonce verification ───────────────────────────────────────────────

  describe('nonce verification', () => {
    it('ignores messages with wrong nonce after INIT', () => {
      bridge.handleMessage({
        source: mockParent,
        origin: 'null',
        data: { type: 'INIT', nonce: TEST_NONCE, payload: {} },
      } as unknown as MessageEvent)

      mockParent.postMessage.mockClear()

      bridge.handleMessage({
        source: mockParent,
        origin: 'null',
        data: { type: 'RENDER_DATA', nonce: 'wrong-nonce', payload: {} },
      } as unknown as MessageEvent)

      // No response sent for wrong nonce
      expect(mockParent.postMessage).not.toHaveBeenCalled()
    })

    it('ignores messages before INIT', () => {
      bridge.handleMessage({
        source: mockParent,
        origin: 'null',
        data: { type: 'RENDER_DATA', nonce: TEST_NONCE, payload: {} },
      } as unknown as MessageEvent)

      // No processing before INIT
      expect(mockParent.postMessage).not.toHaveBeenCalled()
    })
  })

  // ─── Source verification ──────────────────────────────────────────────

  describe('source verification', () => {
    it('ignores messages not from parent', () => {
      const foreignSource = { postMessage: vi.fn() }

      bridge.handleMessage({
        source: foreignSource,
        origin: 'https://evil.com',
        data: { type: 'INIT', nonce: TEST_NONCE, payload: {} },
      } as unknown as MessageEvent)

      expect(bridge.getNonce()).toBeNull()
    })
  })

  // ─── Unknown message rejection ────────────────────────────────────────

  describe('unknown message rejection', () => {
    it('ignores unknown message types', () => {
      bridge.handleMessage({
        source: mockParent,
        origin: 'null',
        data: { type: 'INIT', nonce: TEST_NONCE, payload: {} },
      } as unknown as MessageEvent)

      mockParent.postMessage.mockClear()

      bridge.handleMessage({
        source: mockParent,
        origin: 'null',
        data: { type: 'UNKNOWN_TYPE', nonce: TEST_NONCE, payload: {} },
      } as unknown as MessageEvent)

      expect(mockParent.postMessage).not.toHaveBeenCalled()
    })
  })

  // ─── NETWORK_REQUEST proxying ─────────────────────────────────────────

  describe('NETWORK_REQUEST proxying', () => {
    it('dispatches network request event', () => {
      // Initialize
      bridge.handleMessage({
        source: mockParent,
        origin: 'null',
        data: { type: 'INIT', nonce: TEST_NONCE, payload: {} },
      } as unknown as MessageEvent)

      const networkSpy = vi.fn()
      bridge.onNetworkRequest(networkSpy)

      bridge.handleMessage({
        source: mockParent,
        origin: 'null',
        data: {
          type: 'INIT',
          nonce: TEST_NONCE,
          payload: {},
        },
      } as unknown as MessageEvent)

      // Simulate a NETWORK_REQUEST coming from the sandbox side (internal)
      const requestPayload = {
        requestId: 'req-1',
        url: 'https://api.example.com/data',
        method: 'GET',
        headers: {},
      }

      bridge.simulateNetworkRequest(requestPayload)
      expect(networkSpy).toHaveBeenCalledWith(requestPayload)
    })
  })
})
