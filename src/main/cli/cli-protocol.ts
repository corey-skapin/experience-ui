// src/main/cli/cli-protocol.ts
// T021 — JSON-RPC 2.0 protocol encoder/decoder for the Copilot CLI subprocess.
// Per contracts/cli-protocol.md: newline-delimited messages over stdin/stdout.

// ─── Message Types ────────────────────────────────────────────────────────────

export interface CLIRequest {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params?: Record<string, unknown>;
}

export interface CLIResponse {
  jsonrpc: '2.0';
  id: number;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

export interface CLINotification {
  jsonrpc: '2.0';
  method: string;
  params?: Record<string, unknown>;
}

export interface CLIStreamChunk {
  jsonrpc: '2.0';
  method: 'stream/chunk';
  params: {
    requestId: number;
    chunk: string;
    done: boolean;
    index: number;
  };
}

export type CLIMessage = CLIRequest | CLIResponse | CLINotification | CLIStreamChunk;

// ─── Error Codes ──────────────────────────────────────────────────────────────

/**
 * JSON-RPC 2.0 standard error codes and application-level error codes.
 * Per contracts/cli-protocol.md error code table.
 */
export const CLI_ERROR_CODES = {
  /** Invalid JSON received from CLI. */
  PARSE_ERROR: -32700,
  /** Missing required JSON-RPC fields. */
  INVALID_REQUEST: -32600,
  /** Unknown method name. */
  METHOD_NOT_FOUND: -32601,
  /** Malformed parameters. */
  INVALID_PARAMS: -32602,
  /** CLI internal error. */
  INTERNAL_ERROR: -32603,
  /** Code generation failed. */
  GENERATION_FAILED: -32000,
  /** Customization could not be applied. */
  CUSTOMIZATION_FAILED: -32001,
  /** Provided spec is invalid. */
  SPEC_INVALID: -32002,
  /** Input exceeds context window. */
  CONTEXT_TOO_LARGE: -32003,
  /** Too many requests (queue overflow). */
  RATE_LIMITED: -32004,
} as const;

// ─── Serialization ────────────────────────────────────────────────────────────

/**
 * Serialize a JSON-RPC 2.0 request to a newline-terminated string.
 * The message is a single line of JSON followed by `\n`.
 */
export function serializeRequest(
  id: number,
  method: string,
  params?: Record<string, unknown>,
): string {
  const request: CLIRequest = { jsonrpc: '2.0', id, method };
  if (params !== undefined) {
    request.params = params;
  }
  return JSON.stringify(request) + '\n';
}

// ─── Parsing ──────────────────────────────────────────────────────────────────

/**
 * Parse a raw JSON-RPC line into a CLIMessage.
 * Throws a SyntaxError if the input is not valid JSON.
 */
export function parseMessage(raw: string): CLIMessage {
  // JSON.parse throws SyntaxError on invalid JSON — let it propagate
  const parsed = JSON.parse(raw) as unknown;
  return parsed as CLIMessage;
}

// ─── Type Guards ──────────────────────────────────────────────────────────────

/**
 * True when the message is a `stream/chunk` notification from the CLI.
 * Stream chunks have `method === "stream/chunk"` and no `id`.
 */
export function isStreamChunk(msg: CLIMessage): msg is CLIStreamChunk {
  return 'method' in msg && (msg as CLINotification).method === 'stream/chunk' && !('id' in msg);
}

/**
 * True when the message is a notification (has `method`, no `id`).
 * Both regular notifications and stream/chunk messages satisfy this.
 */
export function isNotification(msg: CLIMessage): msg is CLINotification {
  return 'method' in msg && !('id' in msg);
}

/**
 * True when the message is a response (has `id`, no `method`).
 * Covers both success responses and error responses.
 */
export function isResponse(msg: CLIMessage): msg is CLIResponse {
  return 'id' in msg && !('method' in msg);
}

/**
 * True when the message is an error response (`id` present, `error` field set).
 */
export function isErrorResponse(msg: CLIMessage): msg is CLIResponse {
  return isResponse(msg) && (msg as CLIResponse).error !== undefined;
}
