/**
 * CLI JSON-RPC 2.0 protocol encoder/decoder.
 * Handles request framing (newline-delimited), response parsing,
 * stream chunk assembly, error handling, and notifications.
 *
 * Per specs/001-api-ui-generator/contracts/cli-protocol.md
 */

// ─── JSON-RPC 2.0 types ───────────────────────────────────────────────────

export interface CLIRequest {
  jsonrpc: '2.0'
  id: number
  method: string
  params?: Record<string, unknown>
}

export interface CLIResponse {
  jsonrpc: '2.0'
  id: number
  result: unknown
}

export interface CLIErrorResponse {
  jsonrpc: '2.0'
  id: number
  error: {
    code: number
    message: string
    data?: unknown
  }
}

export interface CLINotification {
  jsonrpc: '2.0'
  method: string
  params?: Record<string, unknown>
}

export interface CLIStreamChunk {
  jsonrpc: '2.0'
  method: 'stream/chunk'
  params: {
    requestId: number
    chunk: string
    done: boolean
    index: number
  }
}

export type CLIMessage = CLIResponse | CLIErrorResponse | CLIStreamChunk | CLINotification

// ─── Error codes ──────────────────────────────────────────────────────────

export const CLI_ERROR_CODES = {
  // Standard JSON-RPC 2.0
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  // Application-level
  GENERATION_FAILED: -32000,
  CUSTOMIZATION_FAILED: -32001,
  SPEC_INVALID: -32002,
  CONTEXT_TOO_LARGE: -32003,
  RATE_LIMITED: -32004,
} as const

// ─── Type guards ──────────────────────────────────────────────────────────

/** Returns true if the message is a successful response (has `result`). */
export function isResponse(msg: unknown): msg is CLIResponse {
  if (!msg || typeof msg !== 'object') return false
  const m = msg as Record<string, unknown>
  return m.jsonrpc === '2.0' && 'id' in m && 'result' in m && !('error' in m)
}

/** Returns true if the message is an error response (has `error`). */
export function isError(msg: unknown): msg is CLIErrorResponse {
  if (!msg || typeof msg !== 'object') return false
  const m = msg as Record<string, unknown>
  return m.jsonrpc === '2.0' && 'id' in m && 'error' in m
}

/** Returns true if the message is a stream/chunk notification. */
export function isStreamChunk(msg: unknown): msg is CLIStreamChunk {
  if (!msg || typeof msg !== 'object') return false
  const m = msg as Record<string, unknown>
  return m.jsonrpc === '2.0' && m.method === 'stream/chunk' && !('id' in m)
}

/** Returns true if the message is a generic notification (method, no id). */
export function isNotification(msg: unknown): msg is CLINotification {
  if (!msg || typeof msg !== 'object') return false
  const m = msg as Record<string, unknown>
  return m.jsonrpc === '2.0' && 'method' in m && !('id' in m)
}

// ─── Encoder ─────────────────────────────────────────────────────────────

/**
 * Encodes a JSON-RPC 2.0 request as a newline-terminated string.
 * @param id - Monotonically increasing request ID
 * @param method - RPC method name
 * @param params - Optional method parameters
 */
export function encodeRequest(
  id: number,
  method: string,
  params?: Record<string, unknown>,
): string {
  const req: CLIRequest = { jsonrpc: '2.0', id, method }
  if (params !== undefined) {
    req.params = params
  }
  return JSON.stringify(req) + '\n'
}

/**
 * Encodes a JSON-RPC 2.0 notification (no id, no response expected).
 */
export function encodeNotification(method: string, params?: Record<string, unknown>): string {
  const notif: CLINotification = { jsonrpc: '2.0', method }
  if (params !== undefined) {
    notif.params = params
  }
  return JSON.stringify(notif) + '\n'
}

// ─── Decoder ─────────────────────────────────────────────────────────────

/**
 * Parses a raw newline-delimited JSON string into a CLIMessage.
 * Returns null if the string is not a valid JSON-RPC 2.0 message.
 */
export function decodeMessage(raw: string): CLIMessage | null {
  const trimmed = raw.trimEnd()
  if (!trimmed) return null

  let parsed: unknown
  try {
    parsed = JSON.parse(trimmed)
  } catch {
    return null
  }

  if (!parsed || typeof parsed !== 'object') return null
  const msg = parsed as Record<string, unknown>

  if (msg.jsonrpc !== '2.0') return null

  // Must have result, error, or method
  if (!('result' in msg) && !('error' in msg) && !('method' in msg)) return null

  return parsed as CLIMessage
}

// ─── Stream buffer ────────────────────────────────────────────────────────

/**
 * Reassembles stream chunks for a given requestId into accumulated text.
 * Returns the full assembled string when done is true.
 */
export class StreamBuffer {
  private readonly chunks: Map<number, string[]> = new Map()

  /**
   * Appends a chunk to the buffer.
   * @returns The full assembled string if done, otherwise null.
   */
  push(chunk: CLIStreamChunk['params']): string | null {
    const { requestId, chunk: text, done } = chunk
    if (!this.chunks.has(requestId)) {
      this.chunks.set(requestId, [])
    }
    const arr = this.chunks.get(requestId)
    if (arr) arr.push(text)

    if (done) {
      const assembled = this.chunks.get(requestId)?.join('') ?? ''
      this.chunks.delete(requestId)
      return assembled
    }
    return null
  }

  /** Returns current accumulated text for a request without completing it. */
  peek(requestId: number): string {
    return (this.chunks.get(requestId) ?? []).join('')
  }

  /** Clears the buffer for a given requestId. */
  clear(requestId: number): void {
    this.chunks.delete(requestId)
  }
}
