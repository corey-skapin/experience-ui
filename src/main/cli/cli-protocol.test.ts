import { describe, it, expect } from 'vitest';
import { encodeRequest, decodeMessage, ERROR_CODE_NAMES } from './cli-protocol';
import type { CLIRequest, CLIResponse, CLIStreamChunk, CLINotification } from './cli-protocol';

describe('encodeRequest', () => {
  it('serializes a CLIRequest to a newline-delimited JSON string', () => {
    const request: CLIRequest = {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: { clientName: 'experience-ui', clientVersion: '1.0.0' },
    };
    const encoded = encodeRequest(request);
    expect(encoded).toBe(JSON.stringify(request) + '\n');
  });

  it('serializes a CLIRequest without params', () => {
    const request: CLIRequest = { jsonrpc: '2.0', id: 2, method: 'ping' };
    const encoded = encodeRequest(request);
    const parsed = JSON.parse(encoded.trim());
    expect(parsed.jsonrpc).toBe('2.0');
    expect(parsed.id).toBe(2);
    expect(parsed.method).toBe('ping');
    expect(parsed.params).toBeUndefined();
  });

  it('always ends with a newline character', () => {
    const request: CLIRequest = { jsonrpc: '2.0', id: 3, method: 'chat' };
    expect(encodeRequest(request)).toMatch(/\n$/);
  });
});

describe('decodeMessage', () => {
  it('parses a successful CLIResponse', () => {
    const raw: CLIResponse = {
      jsonrpc: '2.0',
      id: 1,
      result: { serverName: 'copilot-cli', serverVersion: '1.2.0' },
    };
    const line = JSON.stringify(raw);
    const decoded = decodeMessage(line);
    expect(decoded).toEqual(raw);
  });

  it('parses a CLIResponse with an error field', () => {
    const raw: CLIResponse = {
      jsonrpc: '2.0',
      id: 2,
      error: { code: -32600, message: 'Invalid Request' },
    };
    const decoded = decodeMessage(JSON.stringify(raw));
    expect(decoded).toEqual(raw);
  });

  it('parses a CLIStreamChunk (method stream/chunk with no id)', () => {
    const raw: CLIStreamChunk = {
      jsonrpc: '2.0',
      method: 'stream/chunk',
      params: { requestId: 2, chunk: 'partial code', done: false, index: 0 },
    };
    const decoded = decodeMessage(JSON.stringify(raw));
    expect(decoded).toEqual(raw);
  });

  it('parses a CLINotification (method present, no id)', () => {
    const raw: CLINotification = {
      jsonrpc: '2.0',
      method: 'server/ready',
      params: { status: 'ok' },
    };
    const decoded = decodeMessage(JSON.stringify(raw));
    expect(decoded).toEqual(raw);
  });

  it('throws on invalid JSON', () => {
    expect(() => decodeMessage('not json{')).toThrow();
  });

  it('throws on non-jsonrpc 2.0 message', () => {
    expect(() => decodeMessage(JSON.stringify({ jsonrpc: '1.0', id: 1 }))).toThrow();
  });
});

describe('stream chunk handling', () => {
  it('identifies a non-final chunk (done=false)', () => {
    const chunk: CLIStreamChunk = {
      jsonrpc: '2.0',
      method: 'stream/chunk',
      params: { requestId: 3, chunk: 'hello ', done: false, index: 0 },
    };
    const decoded = decodeMessage(JSON.stringify(chunk)) as CLIStreamChunk;
    expect(decoded.params.done).toBe(false);
    expect(decoded.params.index).toBe(0);
  });

  it('identifies the final chunk (done=true)', () => {
    const chunk: CLIStreamChunk = {
      jsonrpc: '2.0',
      method: 'stream/chunk',
      params: { requestId: 3, chunk: 'world', done: true, index: 1 },
    };
    const decoded = decodeMessage(JSON.stringify(chunk)) as CLIStreamChunk;
    expect(decoded.params.done).toBe(true);
    expect(decoded.params.index).toBe(1);
  });

  it('preserves requestId so chunks can be matched to original request', () => {
    const chunk: CLIStreamChunk = {
      jsonrpc: '2.0',
      method: 'stream/chunk',
      params: { requestId: 42, chunk: 'data', done: false, index: 5 },
    };
    const decoded = decodeMessage(JSON.stringify(chunk)) as CLIStreamChunk;
    expect(decoded.params.requestId).toBe(42);
  });
});

describe('ERROR_CODE_NAMES', () => {
  it('maps -32700 to "Parse Error"', () => {
    expect(ERROR_CODE_NAMES[-32700]).toBe('Parse Error');
  });

  it('maps -32600 to "Invalid Request"', () => {
    expect(ERROR_CODE_NAMES[-32600]).toBe('Invalid Request');
  });

  it('maps -32601 to "Method Not Found"', () => {
    expect(ERROR_CODE_NAMES[-32601]).toBe('Method Not Found');
  });

  it('maps -32602 to "Invalid Params"', () => {
    expect(ERROR_CODE_NAMES[-32602]).toBe('Invalid Params');
  });

  it('maps -32603 to "Internal Error"', () => {
    expect(ERROR_CODE_NAMES[-32603]).toBe('Internal Error');
  });

  it('maps -32000 to "Generation Failed"', () => {
    expect(ERROR_CODE_NAMES[-32000]).toBe('Generation Failed');
  });

  it('maps -32001 to "Customization Failed"', () => {
    expect(ERROR_CODE_NAMES[-32001]).toBe('Customization Failed');
  });

  it('maps -32002 to "Spec Invalid"', () => {
    expect(ERROR_CODE_NAMES[-32002]).toBe('Spec Invalid');
  });

  it('maps -32003 to "Context Too Large"', () => {
    expect(ERROR_CODE_NAMES[-32003]).toBe('Context Too Large');
  });

  it('maps -32004 to "Rate Limited"', () => {
    expect(ERROR_CODE_NAMES[-32004]).toBe('Rate Limited');
  });
});

describe('notification handling', () => {
  it('identifies a notification by absence of id field', () => {
    const notification: CLINotification = {
      jsonrpc: '2.0',
      method: 'log/message',
      params: { level: 'info', message: 'CLI ready' },
    };
    const decoded = decodeMessage(JSON.stringify(notification)) as CLINotification;
    expect('id' in decoded).toBe(false);
    expect(decoded.method).toBe('log/message');
  });

  it('distinguishes a notification (no id) from a response (has id)', () => {
    const response: CLIResponse = { jsonrpc: '2.0', id: 5, result: 'ok' };
    const notification: CLINotification = { jsonrpc: '2.0', method: 'ping' };
    const decodedResponse = decodeMessage(JSON.stringify(response));
    const decodedNotification = decodeMessage(JSON.stringify(notification));
    expect('id' in decodedResponse).toBe(true);
    expect('id' in decodedNotification).toBe(false);
  });
});
