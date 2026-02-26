# Research: API-Driven UI Generator

**Feature Branch**: `001-api-ui-generator`
**Date**: 2025-07-24
**Status**: Complete — all unknowns resolved

---

## R1: Copilot CLI Subprocess Management

### Decision

Use `child_process.spawn()` from Electron main process with newline-delimited JSON-RPC 2.0 over stdin/stdout. Implement a state-machine manager with request queuing and automatic restart on crash.

### Rationale

- `spawn()` provides streams-based I/O (memory-efficient, no buffer limits unlike `exec()`'s 512KB cap)
- JSON-RPC 2.0 is the de-facto standard for CLI tool communication (used by LSP, DAP, MCP)
- Newline-delimited framing is simpler than length-prefixed and human-readable for debugging
- State machine (stopped → running → crashed) prevents race conditions and enables clean request queuing

### Alternatives Considered

| Alternative             | Rejected Because                                              |
| ----------------------- | ------------------------------------------------------------- |
| `child_process.exec()`  | Buffers entire output (512KB limit), spawns unnecessary shell |
| `child_process.fork()`  | Designed for Node.js workers, not external CLI tools          |
| Length-prefixed framing | More complex parsing with no benefit for JSON messages        |
| WebSocket to CLI        | Adds unnecessary network layer for a local subprocess         |

### Key Implementation Details

- **Backpressure handling**: Monitor `write()` return value on stdin; pause writes on `false`, resume on `drain` event
- **Crash detection**: Listen for `exit` and `error` events; exponential backoff restart (5s → 10s → 30s)
- **Request timeout**: 30-second timeout per request with automatic rejection
- **Environment filtering**: Whitelist only safe environment variables (PATH, HOME, SHELL, NODE_ENV, LANG) to prevent credential leakage
- **IPC bridge**: Electron main process exposes CLI via `ipcMain.handle()` channels; renderer never spawns processes directly

---

## R2: Sandbox Iframe Security Architecture

### Decision

Render generated React/HTML/CSS inside a sandboxed iframe with `sandbox="allow-scripts"` only (no `allow-same-origin`). Use nonce-based CSP, controlled postMessage bridge, and fetch interception for network proxying. Compile generated code via esbuild in the Electron main process before injection.

### Rationale

- Without `allow-same-origin`, the iframe gets a unique `null` origin — completely isolated from host localStorage, cookies, and DOM
- Nonce-based CSP ensures only code produced by the generation pipeline executes
- esbuild in main process keeps compilation off the renderer thread and prevents generated code from accessing Node.js APIs
- postMessage with origin checks and allowlisted message types creates a minimal, auditable attack surface

### Alternatives Considered

| Alternative                   | Rejected Because                                                                   |
| ----------------------------- | ---------------------------------------------------------------------------------- |
| `allow-same-origin` on iframe | Would grant generated code access to host localStorage, cookies, and parent window |
| WebView tag (Electron)        | Deprecated in favor of BrowserView/iframe; heavier resource usage                  |
| Shadow DOM isolation only     | No process isolation; generated code shares same JS context as host                |
| In-browser esbuild (wasm)     | Adds ~10MB to renderer bundle; slower than native esbuild in main process          |

### Key Implementation Details

- **CSP policy**: `default-src 'none'; script-src 'nonce-{UNIQUE}'; style-src 'nonce-{UNIQUE}' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'`
- **Code validation**: Pre-injection scan for disallowed patterns (`eval`, `Function()`, `document.cookie`, `window.parent`, `window.top`, `postMessage` to non-host origins, Node.js module requires)
- **Network proxy**: Override `window.fetch` and `XMLHttpRequest` in sandbox to route all requests through postMessage → host → Electron main process → external API
- **React runtime**: Pre-bundled minimal React+ReactDOM served as external scripts with nonces; generated code imports from these
- **CSP violation logging**: `report-uri` directive to capture and log violations via the debug console

---

## R3: API Specification Parsing Libraries

### Decision

Use `@apidevtools/swagger-parser` (v10.1+) for OpenAPI 3.x and Swagger 2.0, `swagger2openapi` (v7.0.8+) for Swagger 2.0→3.x conversion, and `graphql` (v16.8+) with `@graphql-tools/schema` (v10+) for GraphQL. Normalize all formats into a unified `NormalizedSpec` interface.

### Rationale

- `swagger-parser` provides the best combination of validation, `$ref` dereferencing, and TypeScript types
- `swagger2openapi` produces true OpenAPI 3.x output (swagger-parser's built-in conversion is minimal)
- `graphql` package is the official reference implementation; `@graphql-tools/schema` adds schema merging and validation utilities
- Unified `NormalizedSpec` enables shared UI rendering logic regardless of input format

### Alternatives Considered

| Alternative                   | Rejected Because                                            |
| ----------------------------- | ----------------------------------------------------------- |
| `openapi-parser` (fork)       | Less actively maintained than `@apidevtools/swagger-parser` |
| `openapi3-ts`                 | Schema types only — no validation or parsing                |
| Manual GraphQL parsing        | Reinventing the wheel; `graphql` package is battle-tested   |
| Single parser for all formats | No library handles all three formats adequately             |

### Key Implementation Details

- **Format auto-detection**: Check for `openapi` field (3.x), `swagger` field (2.0), `type Query`/`__schema` (GraphQL)
- **External `$ref` handling**: Catch `UnresolvedError` from swagger-parser; surface missing references to user with manual-provide option
- **Large spec performance**: Lazy dereferencing (`circular: 'ignore'`), UI pagination (20 endpoints per page), optional worker thread for parsing
- **Unified model**: `NormalizedSpec` with `endpoints[]` (REST) and `queries[]`/`mutations[]` (GraphQL), plus `models[]`/`types[]` for schemas

---

## R4: Version History & Rollback Strategy

### Decision

Hybrid approach: `better-sqlite3` for version metadata + filesystem for full code snapshots. Store complete generated source per version (not diffs). Append-only history where rollbacks create new version entries.

### Rationale

- Full snapshots enable <3s rollback (no reconstruction from diffs needed)
- SQLite metadata enables fast querying/filtering (10ms for 200 versions)
- Filesystem code storage avoids database bloat (generated React code: 50–200KB per version)
- Desktop Electron app has full filesystem access — no web storage limitations
- Estimated storage: ~10–15MB per interface for 100 versions (acceptable for desktop)

### Alternatives Considered

| Alternative              | Rejected Because                                               |
| ------------------------ | -------------------------------------------------------------- |
| IndexedDB for everything | 500MB browser limit; poor querying for metadata                |
| Diff-based storage only  | Rollback requires reconstruction — violates <3s requirement    |
| Git-based versioning     | Overkill; adds process dependency; slower than direct file I/O |
| In-memory only           | No cross-session persistence                                   |

### Key Implementation Details

- **Storage layout**: `{userData}/interfaces/{id}/versions/v{n}/generated.tsx` + `versions.db`
- **Version schema**: `id, interface_id, version_number, parent_version_id, is_revert, reverted_from_id, created_at, description, change_type, code_path, code_hash, generation_prompt`
- **Rollback**: Create new version entry pointing to target version's code file; update active pointer
- **Diffing**: Lazy computation with `diff-match-patch` library; LRU cache of 20 most recent diffs
- **Pruning**: Optional archival after 500 versions per interface

---

## R5: API Authentication Management

### Decision

Three-tier credential architecture: OS keychain via `keytar` (refresh tokens), in-memory Map with TTL (access tokens), IPC bridge for renderer (never expose tokens to renderer process). OAuth 2.0 via PKCE flow in a dedicated BrowserWindow.

### Rationale

- `keytar` uses native OS credential stores (Windows DPAPI/Credential Manager, macOS Keychain, Linux libsecret) — most secure option for persistent storage
- In-memory tokens with TTL auto-cleanup limit exposure window
- IPC bridge ensures renderer process never sees raw credentials — all API calls routed through main process
- PKCE (S256) prevents authorization code interception attacks

### Alternatives Considered

| Alternative                       | Rejected Because                                                 |
| --------------------------------- | ---------------------------------------------------------------- |
| `electron-store` (encrypted JSON) | Less secure than OS keychain; single-key encryption              |
| `safeStorage` only                | Uses Node/Chromium crypto — not as robust as OS-native keychains |
| `node-keychain`                   | Abandoned; `keytar` is actively maintained                       |
| localStorage for tokens           | Vulnerable to XSS; accessible from renderer process              |

### Key Implementation Details

- **Per-base-URL scoping**: `Map<baseUrl, CredentialSet>` — all tabs sharing a base URL use same credentials
- **OAuth flow**: Dedicated `BrowserWindow` with `sandbox: true`, `nodeIntegration: false`; intercept redirect via `will-redirect` event
- **Health monitoring**: Periodic health checks (5-min interval) with 401 detection → automatic token refresh → notify renderer
- **Credential expiration**: Proactive TTL timers; clear tokens 1 minute before stated expiry
- **Supported auth types**: API Key (header/query), Bearer Token, OAuth 2.0 (Authorization Code + PKCE)

---

## R6: UI Component Library & Design System

### Decision

Radix UI primitives + Tailwind CSS with CSS custom properties for theming. `react-resizable-panels` for split panes. `@tanstack/virtual` for chat and console virtualization. `lucide-react` for icons. `@dnd-kit/core` for tab drag-reorder. `highlight.js` for console syntax highlighting.

### Rationale

- Radix UI provides comprehensive WAI-ARIA implementations out of the box (24+ primitives) — critical for WCAG 2.1 AA compliance
- Tailwind + CSS variables enables easy light/dark theme switching without rebuild
- `react-resizable-panels` has proper keyboard navigation (arrow keys + Tab) and WCAG compliance — unlike allotment which has accessibility issues
- `@tanstack/virtual` is the modern standard for list virtualization (10KB, 60fps at 10K items)
- Total UI library bundle overhead: ~85KB minified (well within performance budget)

### Alternatives Considered

| Alternative            | Rejected Because                                                          |
| ---------------------- | ------------------------------------------------------------------------- |
| MUI (Material UI)      | Larger bundle (~300KB); opinionated design system harder to customize     |
| Headless UI            | Missing compound components (tabs, combobox); fewer primitives than Radix |
| Ariakit                | Strong ARIA but smaller ecosystem; fewer battle-tested components         |
| allotment (split pane) | WCAG accessibility issues; keyboard navigation is limited                 |
| react-window           | Older, larger (22KB), fewer features than @tanstack/virtual               |
| Prism.js               | 25KB — overkill for console highlighting; highlight.js is 9KB             |
| Heroicons              | Slightly larger bundle; Tailwind-native but less versatile                |

### Key Implementation Details

- **Design tokens**: CSS custom properties for spacing, typography, color, border-radius; Tailwind config maps to token values
- **Theme switching**: `dark:` Tailwind variant + CSS variable swapping on `<html>` element
- **Tab overflow**: Horizontal scroll with overflow indicators + `@dnd-kit` for drag reorder (~17KB total)
- **Chat virtualization**: `@tanstack/virtual` with variable-height message items; auto-scroll to bottom on new messages
- **Console viewer**: Fixed-height container with virtual scroll; client-side filtering via `useMemo` + regex; `highlight.js` for JSON/HTTP response highlighting
- **Minimum viewport**: 1024×768; responsive within Electron window resize constraints
