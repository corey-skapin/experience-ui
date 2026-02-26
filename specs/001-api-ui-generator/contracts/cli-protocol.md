# Contract: Copilot CLI Protocol

**Feature Branch**: `001-api-ui-generator`
**Boundary**: Electron Main Process ↔ Copilot CLI Subprocess
**Protocol**: Newline-delimited JSON-RPC 2.0 over stdin/stdout

---

## Overview

The Electron main process spawns the Copilot CLI as a child process and communicates via stdin (requests) and stdout (responses). All messages are JSON-RPC 2.0 formatted, one message per line, delimited by `\n`.

## Transport

- **stdin** (main → CLI): Request messages and notifications
- **stdout** (CLI → main): Response messages, streaming chunks, and notifications
- **stderr** (CLI → main): Diagnostic logs (not parsed as JSON-RPC; captured for debug console)
- **Encoding**: UTF-8
- **Framing**: Newline-delimited (`\n`)

---

## Message Format

### Request (Main → CLI)

```typescript
interface CLIRequest {
  jsonrpc: '2.0';
  id: number; // Monotonically increasing request ID
  method: string; // Method name
  params?: Record<string, unknown>;
}
```

### Response (CLI → Main)

```typescript
interface CLIResponse {
  jsonrpc: '2.0';
  id: number; // Matches request ID
  result?: unknown; // On success
  error?: {
    // On failure
    code: number;
    message: string;
    data?: unknown;
  };
}
```

### Notification (either direction, no response expected)

```typescript
interface CLINotification {
  jsonrpc: '2.0';
  method: string;
  params?: Record<string, unknown>;
  // Note: no `id` field — notifications don't get responses
}
```

### Streaming Response (CLI → Main)

For long-running operations, the CLI sends incremental chunks before the final response:

```typescript
interface CLIStreamChunk {
  jsonrpc: '2.0';
  method: 'stream/chunk';
  params: {
    requestId: number; // Original request ID
    chunk: string; // Partial content
    done: boolean; // Whether this is the final chunk
    index: number; // Chunk sequence number
  };
}
```

---

## Methods

### `initialize`

Handshake — verify CLI is ready and exchange capability information.

```typescript
// Request
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "clientName": "experience-ui",
    "clientVersion": "1.0.0",
    "capabilities": {
      "streaming": true,
      "specFormats": ["openapi3", "swagger2", "graphql"]
    }
  }
}

// Response
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "serverName": "copilot-cli",
    "serverVersion": "1.2.0",
    "capabilities": {
      "codeGeneration": true,
      "customization": true,
      "streaming": true
    }
  }
}
```

### `generate`

Generate a UI interface from a parsed API specification.

```typescript
// Request
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "generate",
  "params": {
    "spec": { /* NormalizedSpec object */ },
    "format": "react",
    "theme": "light",
    "options": {
      "layout": "default",
      "includeAuth": true,
      "pagination": true
    }
  }
}

// Streaming chunks arrive via stream/chunk notifications
// Final response:
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "code": "/* full React/JSX code */",
    "componentCount": 12,
    "description": "Generated interface with 8 endpoints, data tables, and detail views"
  }
}
```

### `customize`

Apply a natural language modification to an existing generated interface.

```typescript
// Request
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "customize",
  "params": {
    "currentCode": "/* current generated code */",
    "prompt": "Add a search bar to filter results by name",
    "spec": { /* NormalizedSpec for context */ },
    "history": [
      { "role": "user", "content": "Generate an interface for this API" },
      { "role": "assistant", "content": "Generated interface with 8 endpoints" }
    ]
  }
}

// Response
{
  "jsonrpc": "2.0",
  "id": 3,
  "result": {
    "code": "/* updated React/JSX code */",
    "description": "Added a search bar component that filters the results table by the 'name' field",
    "assumptions": ["Filtering is client-side on the currently loaded data"],
    "clarificationNeeded": false
  }
}
```

### `clarify`

CLI asks user for clarification when a request is ambiguous.

```typescript
// Response (instead of result)
{
  "jsonrpc": "2.0",
  "id": 3,
  "result": {
    "code": null,
    "clarificationNeeded": true,
    "question": "I found two tables in the interface. Which one should I add the search bar to: the 'Users' table or the 'Orders' table?",
    "options": ["Users table", "Orders table", "Both tables"]
  }
}
```

### `chat`

General-purpose chat message (not tied to generation/customization).

```typescript
// Request
{
  "jsonrpc": "2.0",
  "id": 4,
  "method": "chat",
  "params": {
    "message": "What formats do you support?",
    "context": {
      "tabId": "tab-1",
      "hasActiveSpec": true,
      "hasActiveInterface": true
    }
  }
}

// Response
{
  "jsonrpc": "2.0",
  "id": 4,
  "result": {
    "message": "I support OpenAPI 3.x, Swagger 2.0, and GraphQL schemas. You can provide them via file upload, URL, or direct paste.",
    "suggestions": ["Upload a spec file", "Paste a URL", "Paste spec content"]
  }
}
```

---

## Error Codes

| Code   | Name                 | Description                        |
| ------ | -------------------- | ---------------------------------- |
| -32700 | Parse Error          | Invalid JSON                       |
| -32600 | Invalid Request      | Missing required fields            |
| -32601 | Method Not Found     | Unknown method name                |
| -32602 | Invalid Params       | Malformed parameters               |
| -32603 | Internal Error       | CLI internal error                 |
| -32000 | Generation Failed    | Code generation failed             |
| -32001 | Customization Failed | Customization could not be applied |
| -32002 | Spec Invalid         | Provided spec is invalid           |
| -32003 | Context Too Large    | Input exceeds context window       |
| -32004 | Rate Limited         | Too many requests                  |

---

## Lifecycle

```text
Main Process                    Copilot CLI
    |                              |
    |--- spawn() ----------------▶| (process starts)
    |                              |
    |--- initialize -------------▶|
    |◀--- result (capabilities) ---|
    |                              |
    |--- generate ---------------▶|
    |◀--- stream/chunk (partial) --|
    |◀--- stream/chunk (partial) --|
    |◀--- stream/chunk (done) -----|
    |◀--- result (final code) -----|
    |                              |
    |--- customize --------------▶|
    |◀--- result (updated code) ---|
    |                              |
    |  ... ongoing communication ...|
    |                              |
    |--- exit notification ------▶|
    |                              | (process exits)
```

## Timeout & Retry Policy

| Method       | Timeout | Retries | Backoff     |
| ------------ | ------- | ------- | ----------- |
| `initialize` | 10s     | 3       | 2s, 5s, 10s |
| `generate`   | 60s     | 1       | N/A         |
| `customize`  | 30s     | 1       | N/A         |
| `chat`       | 15s     | 2       | 3s, 6s      |

## Backpressure

- Main process monitors `stdin.write()` return value
- If `false`: pause sending, wait for `drain` event
- Queue requests in memory during backpressure
- Maximum queue depth: 100 requests (reject with -32004 beyond this)
