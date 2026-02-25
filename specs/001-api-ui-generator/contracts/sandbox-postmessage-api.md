# Contract: Sandbox PostMessage API

**Feature Branch**: `001-api-ui-generator`
**Boundary**: Host Renderer ↔ Sandboxed Iframe
**Protocol**: `window.postMessage` with origin validation and allowlisted message types

---

## Overview

The host Electron renderer communicates with sandboxed iframes (containing generated UI code) exclusively via `postMessage`. This is the **only** communication channel between the host and the sandbox. No shared memory, no shared DOM, no shared storage.

## Security Constraints

- **Origin validation**: Host MUST check `event.origin === 'null'` for sandbox messages (sandboxed iframes without `allow-same-origin` have origin `null`)
- **Message allowlist**: Both sides MUST reject messages with unrecognized `type` values
- **Nonce verification**: Initial handshake includes a session nonce; subsequent messages include this nonce for authentication
- **No sensitive data**: Host MUST NOT send raw credentials, tokens, or internal state through postMessage

---

## Message Schema

All messages follow this base envelope:

```typescript
interface SandboxMessage {
  type: string;           // Message type from allowlist
  payload: unknown;       // Type-specific payload
  nonce: string;          // Session nonce for verification
  timestamp: number;      // Unix timestamp (ms)
  requestId?: string;     // For request/response correlation
}
```

---

## Host → Sandbox Messages

### `INIT`
Initialize the sandbox with configuration and the generated React code bundle.

```typescript
interface InitMessage {
  type: 'INIT';
  payload: {
    nonce: string;              // Session nonce for subsequent messages
    bundledCode: string;        // Compiled React/HTML/CSS bundle
    reactRuntimeUrl: string;    // URL to pre-bundled React runtime
    theme: 'light' | 'dark';   // Current host theme
    containerSize: { width: number; height: number };
  };
}
```

### `RENDER_DATA`
Provide API response data to the generated UI for display.

```typescript
interface RenderDataMessage {
  type: 'RENDER_DATA';
  payload: {
    requestId: string;         // Correlates to a DATA_REQUEST
    data: unknown;             // API response body
    statusCode: number;        // HTTP status code
    headers: Record<string, string>;
  };
}
```

### `THEME_CHANGE`
Notify sandbox of host theme change.

```typescript
interface ThemeChangeMessage {
  type: 'THEME_CHANGE';
  payload: {
    theme: 'light' | 'dark';
  };
}
```

### `RESIZE`
Notify sandbox of container dimension change.

```typescript
interface ResizeMessage {
  type: 'RESIZE';
  payload: {
    width: number;
    height: number;
  };
}
```

### `NETWORK_RESPONSE`
Return the result of a proxied network request.

```typescript
interface NetworkResponseMessage {
  type: 'NETWORK_RESPONSE';
  payload: {
    requestId: string;         // Correlates to a NETWORK_REQUEST
    status: number;
    statusText: string;
    headers: Record<string, string>;
    body: ArrayBuffer | string;
    ok: boolean;
  };
}
```

### `DESTROY`
Signal the sandbox to clean up before iframe removal.

```typescript
interface DestroyMessage {
  type: 'DESTROY';
  payload: {};
}
```

---

## Sandbox → Host Messages

### `READY`
Sandbox has initialized and is ready to receive data.

```typescript
interface ReadyMessage {
  type: 'READY';
  payload: {
    nonce: string;             // Echo back the session nonce
    version: string;           // Sandbox runtime version
  };
}
```

### `RENDER_COMPLETE`
Generated UI has finished rendering.

```typescript
interface RenderCompleteMessage {
  type: 'RENDER_COMPLETE';
  payload: {
    componentCount: number;    // Number of rendered components
    renderTimeMs: number;      // Time to render
  };
}
```

### `NETWORK_REQUEST`
Generated UI needs to make an API call (all network requests proxied through host).

```typescript
interface NetworkRequestMessage {
  type: 'NETWORK_REQUEST';
  payload: {
    requestId: string;         // Unique request ID for correlation
    url: string;               // Target API URL
    method: string;            // HTTP method
    headers: Record<string, string>;
    body?: string;             // Request body
  };
}
```

### `LOG`
Console output from the generated UI (surfaced in debug console).

```typescript
interface LogMessage {
  type: 'LOG';
  payload: {
    level: 'log' | 'warn' | 'error' | 'info' | 'debug';
    message: string;
    data?: unknown;
  };
}
```

### `ERROR`
Runtime error in the generated UI.

```typescript
interface ErrorMessage {
  type: 'ERROR';
  payload: {
    message: string;
    stack?: string;
    componentName?: string;
    isFatal: boolean;          // If true, sandbox should be reloaded
  };
}
```

### `UI_EVENT`
User interaction event within the generated UI (for chat panel feedback).

```typescript
interface UIEventMessage {
  type: 'UI_EVENT';
  payload: {
    eventType: 'click' | 'submit' | 'navigate' | 'select';
    target: string;            // Component or element identifier
    data?: unknown;            // Event-specific data
  };
}
```

---

## Message Type Allowlists

### Host Accepts (from Sandbox)
```typescript
const HOST_ALLOWED_TYPES = [
  'READY',
  'RENDER_COMPLETE',
  'NETWORK_REQUEST',
  'LOG',
  'ERROR',
  'UI_EVENT',
] as const;
```

### Sandbox Accepts (from Host)
```typescript
const SANDBOX_ALLOWED_TYPES = [
  'INIT',
  'RENDER_DATA',
  'THEME_CHANGE',
  'RESIZE',
  'NETWORK_RESPONSE',
  'DESTROY',
] as const;
```

---

## Handshake Sequence

```text
Host                          Sandbox (iframe)
  |                              |
  |--- create iframe ----------▶|
  |                              |
  |--- INIT (nonce, code) -----▶|
  |                              | (executes bundled code)
  |◀--- READY (echo nonce) -----|
  |                              |
  | (validates nonce match)      |
  |                              |
  |--- RENDER_DATA (initial) --▶|
  |                              | (renders UI)
  |◀--- RENDER_COMPLETE --------|
  |                              |
  |  ... ongoing communication ...|
  |                              |
  |--- DESTROY ----------------▶|
  |                              | (cleanup)
  |--- remove iframe ----------▶|
```

---

## Error Handling

| Scenario | Host Behavior | Sandbox Behavior |
|----------|---------------|------------------|
| Nonce mismatch on READY | Destroy iframe, log security warning | N/A |
| Unknown message type received | Silently ignore, log to debug console | Silently ignore |
| NETWORK_REQUEST timeout (>10s) | Send NETWORK_RESPONSE with error | Show loading timeout |
| Fatal ERROR from sandbox | Reload iframe with last safe version | Attempt graceful shutdown |
| CSP violation in sandbox | Log violation via debug console | Blocked silently by browser |
| Malformed message payload | Ignore message, log validation error | Ignore message |
