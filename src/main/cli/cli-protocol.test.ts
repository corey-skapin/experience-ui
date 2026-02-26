// src/main/cli/cli-protocol.test.ts
// T017 — Unit tests for CLI JSON-RPC 2.0 protocol encode/decode.
// Tests are written RED-first: the implementation does not exist yet.
// Covers: request serialization, response parsing, stream chunk handling,
//         error code mapping, notification handling.

import { describe, it, expect } from 'vitest';

import {
  serializeRequest,
  parseMessage,
  isStreamChunk,
  isNotification,
  isResponse,
  isErrorResponse,
  CLI_ERROR_CODES,
  type CLIRequest,
  type CLIResponse,
  type CLINotification,
  type CLIStreamChunk,
} from './cli-protocol';

// ─── Request Serialization ────────────────────────────────────────────────────

describe('serializeRequest', () => {
  it('produces valid JSON-RPC 2.0 envelope with jsonrpc field', () => {
    const line = serializeRequest(1, 'initialize', { clientName: 'experience-ui' });
    const parsed = JSON.parse(line) as CLIRequest;
    expect(parsed.jsonrpc).toBe('2.0');
  });

  it('includes method, id, and params in output', () => {
    const line = serializeRequest(3, 'generate', { format: 'react' });
    const parsed = JSON.parse(line) as CLIRequest;
    expect(parsed.id).toBe(3);
    expect(parsed.method).toBe('generate');
    expect(parsed.params).toEqual({ format: 'react' });
  });

  it('serializes without params when omitted', () => {
    const line = serializeRequest(2, 'ping');
    const parsed = JSON.parse(line) as CLIRequest;
    expect(parsed.id).toBe(2);
    expect(parsed.method).toBe('ping');
    expect(parsed.params).toBeUndefined();
  });

  it('terminates the line with a newline character', () => {
    const line = serializeRequest(1, 'test');
    expect(line.endsWith('\n')).toBe(true);
  });

  it('produces a single-line string (no embedded newlines in content)', () => {
    const line = serializeRequest(1, 'chat', { message: 'hello\nworld' });
    // Should be valid JSON even if message contains newline
    const trimmed = line.trimEnd();
    expect(() => JSON.parse(trimmed)).not.toThrow();
  });

  it('handles zero as a valid request id', () => {
    const line = serializeRequest(0, 'initialize');
    const parsed = JSON.parse(line) as CLIRequest;
    expect(parsed.id).toBe(0);
  });
});

// ─── Response Parsing ────────────────────────────────────────────────────────

describe('parseMessage', () => {
  it('parses a success response with result', () => {
    const raw =
      '{"jsonrpc":"2.0","id":1,"result":{"serverName":"copilot-cli","serverVersion":"1.2.0"}}';
    const msg = parseMessage(raw);
    expect(isResponse(msg)).toBe(true);
    const resp = msg as CLIResponse;
    expect(resp.id).toBe(1);
    expect(resp.result).toMatchObject({ serverName: 'copilot-cli' });
  });

  it('parses an error response with code and message', () => {
    const raw = '{"jsonrpc":"2.0","id":2,"error":{"code":-32601,"message":"Method not found"}}';
    const msg = parseMessage(raw);
    expect(isErrorResponse(msg)).toBe(true);
    const resp = msg as CLIResponse;
    expect(resp.error?.code).toBe(-32601);
    expect(resp.error?.message).toBe('Method not found');
  });

  it('parses error with optional data field', () => {
    const raw =
      '{"jsonrpc":"2.0","id":3,"error":{"code":-32002,"message":"Spec invalid","data":{"field":"/paths"}}}';
    const msg = parseMessage(raw);
    expect(isErrorResponse(msg)).toBe(true);
    const resp = msg as CLIResponse;
    expect(resp.error?.data).toEqual({ field: '/paths' });
  });

  it('throws or returns an error object for invalid JSON', () => {
    expect(() => parseMessage('{ not valid json')).toThrow();
  });

  it('parses a stream/chunk notification correctly', () => {
    const raw =
      '{"jsonrpc":"2.0","method":"stream/chunk","params":{"requestId":2,"chunk":"partial","done":false,"index":0}}';
    const msg = parseMessage(raw);
    expect(isStreamChunk(msg)).toBe(true);
  });
});

// ─── Stream Chunk Handling ────────────────────────────────────────────────────

describe('stream chunk handling', () => {
  it('isStreamChunk returns true for stream/chunk method', () => {
    const chunk: CLIStreamChunk = {
      jsonrpc: '2.0',
      method: 'stream/chunk',
      params: { requestId: 5, chunk: 'hello', done: false, index: 0 },
    };
    expect(isStreamChunk(chunk)).toBe(true);
  });

  it('isStreamChunk returns false for regular responses', () => {
    const resp: CLIResponse = {
      jsonrpc: '2.0',
      id: 5,
      result: { code: 'const x = 1;' },
    };
    expect(isStreamChunk(resp)).toBe(false);
  });

  it('correctly identifies the final chunk via done=true', () => {
    const raw =
      '{"jsonrpc":"2.0","method":"stream/chunk","params":{"requestId":2,"chunk":"end","done":true,"index":7}}';
    const msg = parseMessage(raw) as CLIStreamChunk;
    expect(isStreamChunk(msg)).toBe(true);
    expect(msg.params.done).toBe(true);
    expect(msg.params.index).toBe(7);
  });

  it('handles partial chunk (done=false) without losing chunk content', () => {
    const content = 'function App() {';
    const raw = JSON.stringify({
      jsonrpc: '2.0',
      method: 'stream/chunk',
      params: { requestId: 3, chunk: content, done: false, index: 2 },
    });
    const msg = parseMessage(raw) as CLIStreamChunk;
    expect(msg.params.chunk).toBe(content);
    expect(msg.params.done).toBe(false);
  });

  it('preserves requestId for correlation with the original request', () => {
    const raw = JSON.stringify({
      jsonrpc: '2.0',
      method: 'stream/chunk',
      params: { requestId: 42, chunk: 'x', done: false, index: 0 },
    });
    const msg = parseMessage(raw) as CLIStreamChunk;
    expect(msg.params.requestId).toBe(42);
  });
});

// ─── Error Code Mapping ───────────────────────────────────────────────────────

describe('CLI_ERROR_CODES', () => {
  it('exports -32700 as PARSE_ERROR', () => {
    expect(CLI_ERROR_CODES.PARSE_ERROR).toBe(-32700);
  });

  it('exports -32600 as INVALID_REQUEST', () => {
    expect(CLI_ERROR_CODES.INVALID_REQUEST).toBe(-32600);
  });

  it('exports -32601 as METHOD_NOT_FOUND', () => {
    expect(CLI_ERROR_CODES.METHOD_NOT_FOUND).toBe(-32601);
  });

  it('exports -32602 as INVALID_PARAMS', () => {
    expect(CLI_ERROR_CODES.INVALID_PARAMS).toBe(-32602);
  });

  it('exports -32603 as INTERNAL_ERROR', () => {
    expect(CLI_ERROR_CODES.INTERNAL_ERROR).toBe(-32603);
  });

  it('exports -32000 as GENERATION_FAILED (app-level error)', () => {
    expect(CLI_ERROR_CODES.GENERATION_FAILED).toBe(-32000);
  });

  it('exports -32001 as CUSTOMIZATION_FAILED', () => {
    expect(CLI_ERROR_CODES.CUSTOMIZATION_FAILED).toBe(-32001);
  });

  it('exports -32002 as SPEC_INVALID', () => {
    expect(CLI_ERROR_CODES.SPEC_INVALID).toBe(-32002);
  });

  it('exports -32003 as CONTEXT_TOO_LARGE', () => {
    expect(CLI_ERROR_CODES.CONTEXT_TOO_LARGE).toBe(-32003);
  });

  it('exports -32004 as RATE_LIMITED', () => {
    expect(CLI_ERROR_CODES.RATE_LIMITED).toBe(-32004);
  });
});

// ─── Notification Handling ────────────────────────────────────────────────────

describe('notification handling', () => {
  it('isNotification returns true when there is no id field', () => {
    const notif: CLINotification = {
      jsonrpc: '2.0',
      method: 'progress',
      params: { step: 'parsing' },
    };
    expect(isNotification(notif)).toBe(true);
  });

  it('isNotification returns false for requests that have an id', () => {
    const req: CLIRequest = { jsonrpc: '2.0', id: 1, method: 'generate' };
    expect(isNotification(req)).toBe(false);
  });

  it('isNotification returns false for responses that have an id', () => {
    const resp: CLIResponse = { jsonrpc: '2.0', id: 1, result: {} };
    expect(isNotification(resp)).toBe(false);
  });

  it('parses notification from raw JSON string', () => {
    const raw = '{"jsonrpc":"2.0","method":"$/progress","params":{"value":50}}';
    const msg = parseMessage(raw);
    expect(isNotification(msg)).toBe(true);
    const notif = msg as CLINotification;
    expect(notif.method).toBe('$/progress');
    expect(notif.params?.value).toBe(50);
  });

  it('notification without params is still valid', () => {
    const raw = '{"jsonrpc":"2.0","method":"$/cancel"}';
    const msg = parseMessage(raw);
    expect(isNotification(msg)).toBe(true);
    const notif = msg as CLINotification;
    expect(notif.params).toBeUndefined();
  });

  it('isResponse returns false for notifications', () => {
    const notif: CLINotification = { jsonrpc: '2.0', method: 'ping' };
    expect(isResponse(notif)).toBe(false);
  });
});
