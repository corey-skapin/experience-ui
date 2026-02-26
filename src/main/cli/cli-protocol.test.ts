/**
 * Unit tests for CLI JSON-RPC 2.0 protocol encoder/decoder.
 * Tests cover request serialization, response parsing, stream chunk handling,
 * error code mapping, and notification handling.
 *
 * Tests are written FIRST (TDD) and MUST fail before implementation exists.
 */
import { describe, it, expect } from 'vitest'
import {
  encodeRequest,
  decodeMessage,
  isResponse,
  isStreamChunk,
  isNotification,
  isError,
  CLI_ERROR_CODES,
} from './cli-protocol'

// ─── Request encoding ──────────────────────────────────────────────────────

describe('encodeRequest', () => {
  it('produces valid JSON-RPC 2.0 request', () => {
    const line = encodeRequest(1, 'initialize', { clientName: 'test' })
    const parsed = JSON.parse(line.trimEnd()) as Record<string, unknown>

    expect(parsed.jsonrpc).toBe('2.0')
    expect(parsed.id).toBe(1)
    expect(parsed.method).toBe('initialize')
    expect(parsed.params).toEqual({ clientName: 'test' })
  })

  it('appends a newline delimiter', () => {
    const line = encodeRequest(2, 'generate')
    expect(line).toMatch(/\n$/)
  })

  it('omits params when not provided', () => {
    const line = encodeRequest(3, 'chat')
    const parsed = JSON.parse(line) as Record<string, unknown>
    expect('params' in parsed).toBe(false)
  })

  it('increments id correctly', () => {
    const a = encodeRequest(10, 'chat')
    const b = encodeRequest(11, 'chat')
    expect(JSON.parse(a).id).toBe(10)
    expect(JSON.parse(b).id).toBe(11)
  })
})

// ─── Response decoding ────────────────────────────────────────────────────

describe('decodeMessage', () => {
  it('decodes a success response', () => {
    const raw = JSON.stringify({ jsonrpc: '2.0', id: 1, result: { ok: true } })
    const msg = decodeMessage(raw)
    expect(msg).not.toBeNull()
    if (msg) expect(isResponse(msg)).toBe(true)
  })

  it('decodes an error response', () => {
    const raw = JSON.stringify({
      jsonrpc: '2.0',
      id: 2,
      error: { code: -32600, message: 'Invalid Request' },
    })
    const msg = decodeMessage(raw)
    expect(msg).not.toBeNull()
    if (msg) expect(isError(msg)).toBe(true)
  })

  it('decodes a stream chunk notification', () => {
    const raw = JSON.stringify({
      jsonrpc: '2.0',
      method: 'stream/chunk',
      params: { requestId: 5, chunk: 'hello', done: false, index: 0 },
    })
    const msg = decodeMessage(raw)
    expect(msg).not.toBeNull()
    if (msg) expect(isStreamChunk(msg)).toBe(true)
  })

  it('decodes a generic notification (no id)', () => {
    const raw = JSON.stringify({
      jsonrpc: '2.0',
      method: 'cli/ready',
      params: { version: '1.0.0' },
    })
    const msg = decodeMessage(raw)
    expect(msg).not.toBeNull()
    if (msg) expect(isNotification(msg)).toBe(true)
  })

  it('returns null for invalid JSON', () => {
    expect(decodeMessage('not json')).toBeNull()
  })

  it('returns null for non-JSON-RPC payload', () => {
    expect(decodeMessage(JSON.stringify({ foo: 'bar' }))).toBeNull()
  })

  it('strips trailing newline before parsing', () => {
    const raw = JSON.stringify({ jsonrpc: '2.0', id: 1, result: {} }) + '\n'
    expect(decodeMessage(raw)).not.toBeNull()
  })
})

// ─── Stream chunk handling ────────────────────────────────────────────────

describe('stream chunk assembly', () => {
  it('isStreamChunk returns true for stream/chunk method', () => {
    const msg = {
      jsonrpc: '2.0' as const,
      method: 'stream/chunk',
      params: { requestId: 1, chunk: 'x', done: false, index: 0 },
    }
    expect(isStreamChunk(msg)).toBe(true)
  })

  it('isStreamChunk returns false for other methods', () => {
    const msg = {
      jsonrpc: '2.0' as const,
      method: 'stream/other',
      params: {},
    }
    expect(isStreamChunk(msg)).toBe(false)
  })
})

// ─── Error code mapping ───────────────────────────────────────────────────

describe('CLI_ERROR_CODES', () => {
  it('has standard JSON-RPC error codes', () => {
    expect(CLI_ERROR_CODES.PARSE_ERROR).toBe(-32700)
    expect(CLI_ERROR_CODES.INVALID_REQUEST).toBe(-32600)
    expect(CLI_ERROR_CODES.METHOD_NOT_FOUND).toBe(-32601)
    expect(CLI_ERROR_CODES.INVALID_PARAMS).toBe(-32602)
    expect(CLI_ERROR_CODES.INTERNAL_ERROR).toBe(-32603)
  })

  it('has application-level error codes', () => {
    expect(CLI_ERROR_CODES.GENERATION_FAILED).toBe(-32000)
    expect(CLI_ERROR_CODES.CUSTOMIZATION_FAILED).toBe(-32001)
    expect(CLI_ERROR_CODES.SPEC_INVALID).toBe(-32002)
    expect(CLI_ERROR_CODES.CONTEXT_TOO_LARGE).toBe(-32003)
    expect(CLI_ERROR_CODES.RATE_LIMITED).toBe(-32004)
  })
})

// ─── Type guard helpers ───────────────────────────────────────────────────

describe('type guards', () => {
  it('isResponse identifies result messages', () => {
    expect(isResponse({ jsonrpc: '2.0', id: 1, result: 'ok' })).toBe(true)
    expect(isResponse({ jsonrpc: '2.0', id: 1, error: { code: -1, message: 'x' } })).toBe(false)
    expect(isResponse({ jsonrpc: '2.0', method: 'notify' })).toBe(false)
  })

  it('isError identifies error messages', () => {
    expect(isError({ jsonrpc: '2.0', id: 1, error: { code: -1, message: 'x' } })).toBe(true)
    expect(isError({ jsonrpc: '2.0', id: 1, result: {} })).toBe(false)
  })

  it('isNotification identifies notification messages', () => {
    expect(isNotification({ jsonrpc: '2.0', method: 'ready' })).toBe(true)
    expect(isNotification({ jsonrpc: '2.0', id: 1, result: {} })).toBe(false)
  })
})
