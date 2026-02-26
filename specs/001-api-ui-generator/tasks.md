# Tasks: API-Driven UI Generator

**Input**: Design documents from `/specs/001-api-ui-generator/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅, quickstart.md ✅

**Tests**: Included per constitution mandate — "Comprehensive testing is mandatory" and "Test-first development is the preferred approach" (Red-Green-Refactor). Tests are written first within each user story phase and MUST fail before implementation begins.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Electron app** (single project): `src/main/`, `src/renderer/`, `src/sandbox/`, `src/shared/`, `tests/`
- Structure follows plan.md: main process (CLI, proxy, credentials, plugins), renderer (React components, hooks, stores, services), sandbox (isolated iframe runtime), shared (cross-process types and constants)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Initialize the Electron + React + TypeScript project with build tooling, linting, formatting, and test infrastructure.

- [X] T001 Initialize Electron + React project with electron-vite scaffolding, create package.json with scripts (dev, build, test, lint, format, type-check, package) per quickstart.md
- [X] T002 Configure TypeScript strict mode — create tsconfig.json files for main, renderer, and sandbox process targets with `strict: true`, `noExplicitAny`, path alias `@/` pointing to `src/renderer/`
- [X] T003 [P] Install and configure ESLint 9 with `@typescript-eslint/parser`, `@typescript-eslint/no-explicit-any: error`, `max-lines` rule (300), `no-unused-vars`, `no-unused-imports` in eslint.config.js
- [X] T004 [P] Install and configure Prettier with consistent formatting rules in .prettierrc
- [X] T005 Configure husky + lint-staged for pre-commit hooks running lint, type-check, and test on staged files per constitution local verification gate
- [X] T006 [P] Set up Vitest (unit/integration), React Testing Library (component tests), Playwright (E2E), and axe-core (accessibility) test infrastructure with configuration files

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented — shared types, Electron process bootstrap, IPC bridge, React root, design system primitives.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T007 Define all shared TypeScript types and interfaces from data-model.md in src/shared/types/ — APISpec, NormalizedSpec, NormalizedEndpoint, NormalizedOperation, NormalizedModel, SecurityScheme, SpecSource, SpecMetadata, ValidationError, GeneratedInterface, SandboxState, InterfaceVersion, APIConnection, AuthMethod, ConnectionStatus, CLIState, Plugin, Tab, ChatMessage, MessageAttachment, CustomizationRequest, ConsoleEntry, ConsoleRequest, ConsoleResponse, ApplicationState
- [X] T008 [P] Define IPC channel name constants for all domains (cli, auth, proxy, versions, plugins, app) and push notification channel names per electron-ipc-channels.md contract in src/shared/ipc-channels.ts
- [X] T009 [P] Define application constants (default split ratio 30/70, max chat panel width 85%, min 15%, max restart retries 5, request timeouts, CSP policy template, disallowed code patterns list, sandbox message type allowlists) in src/shared/constants.ts
- [X] T010 Create Electron main process entry — BrowserWindow creation with `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, and preload script reference in src/main/index.ts
- [X] T011 Create preload script — expose the full `ExperienceUIBridge` interface via `contextBridge.exposeInMainWorld('experienceUI', {...})` with typed stubs for all IPC domains (cli, auth, proxy, versions, plugins, app) and push notification listener registration per electron-ipc-channels.md in src/main/preload.ts
- [X] T012 Create React root mount with StrictMode and global error boundary in src/renderer/index.tsx
- [X] T013 [P] Set up design system — Tailwind CSS 4 config with CSS custom properties for spacing, typography, color (light/dark themes), border-radius tokens; global stylesheet with base reset and theme variables in src/renderer/styles/
- [X] T014 [P] Build common UI primitives — Button, IconButton, Modal, Dialog, StatusBadge, LoadingSpinner, ProgressBar, ErrorBoundary, EmptyState, Tooltip components using Radix UI primitives + Tailwind in src/renderer/components/common/
- [X] T015 Create minimal App shell component (placeholder layout, renders empty container) with Zustand app-level store for theme, chatPanelWidth, and consoleVisible in src/renderer/App.tsx and src/renderer/stores/app-store.ts
- [X] T016 [P] Create sample API spec test fixtures — valid OpenAPI 3.0 spec, valid Swagger 2.0 spec, valid GraphQL schema, invalid/malformed spec, empty spec (no endpoints), spec with external refs, large spec (50+ endpoints) in tests/fixtures/

**Checkpoint**: Foundation ready — user story implementation can now begin

---

## Phase 3: User Story 1 — Application Shell & API Spec Ingestion (Priority: P1) 🎯 MVP

**Goal**: User opens the app and sees a two-panel layout (chat left, content right). User provides an API spec via file upload, URL, or paste. System parses, validates, generates a React-based UI, compiles with esbuild, validates for security, and renders it in a sandboxed iframe.

**Independent Test**: Provide sample API specs in OpenAPI 3.x, Swagger 2.0, and GraphQL formats; verify that a navigable interface appears in the content area within 30 seconds. Verify error messages for invalid/unsupported specs.

### Tests for User Story 1

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T017 [P] [US1] Write unit tests for CLI protocol JSON-RPC 2.0 encoding/decoding — request serialization, response parsing, stream chunk handling, error code mapping, notification handling in src/main/cli/cli-protocol.test.ts
- [X] T018 [P] [US1] Write unit tests for spec parser — format auto-detection (openapi field, swagger field, GraphQL type Query), OpenAPI 3.x parsing with $ref dereferencing, Swagger 2.0→3.x conversion, GraphQL schema parsing, validation error reporting, unsupported format rejection (RAML/WSDL), empty spec detection in src/renderer/services/spec-parser/spec-parser.test.ts
- [X] T019 [P] [US1] Write unit tests for code validator — detection of disallowed patterns (eval, Function(), document.cookie, window.parent, window.top, postMessage to non-host origins, require/import of Node modules), valid code pass-through, violation counting in src/renderer/services/code-validator/code-validator.test.ts
- [X] T020 [P] [US1] Write unit tests for sandbox postMessage bridge — nonce verification, message type allowlist filtering, INIT handshake, NETWORK_REQUEST proxying, READY echo, unknown message rejection in src/sandbox/bridge.test.ts

### Implementation for User Story 1

- [ ] T021 [P] [US1] Implement CLI JSON-RPC 2.0 protocol encoder/decoder — request framing (newline-delimited), response parsing, stream chunk reassembly, error handling, notification support per cli-protocol.md contract in src/main/cli/cli-protocol.ts
- [ ] T022 [US1] Implement CLI manager — spawn Copilot CLI via child_process.spawn(), stdin/stdout stream management, backpressure handling (drain events), crash detection (exit/error events), exponential backoff restart (5s→10s→30s), request timeout (30s), request queuing, environment variable whitelist, state machine (stopped→starting→running→crashed→restarting) per research.md R1 in src/main/cli/cli-manager.ts
- [ ] T023 [US1] Register CLI IPC handlers — cli:send-message (forward to CLI, return response), cli:get-status (return CLIState), cli:restart (force restart), push notifications cli:status-changed and cli:stream-response in src/main/index.ts
- [ ] T024 [US1] Register app domain IPC handlers — app:compile-code (invoke esbuild.transform with format iife, target es2020), app:validate-code (scan for disallowed patterns from constants.ts) in src/main/index.ts
- [ ] T025 [P] [US1] Create CLI state Zustand store — status, pid, restartCount, pendingRequests, errorMessage; subscribe to cli:status-changed push notifications in src/renderer/stores/cli-store.ts
- [ ] T026 [P] [US1] Create tab Zustand store (single-tab MVP) — one Tab with id, title, apiSpec, generatedInterface, chatHistory, customizationQueue; state transitions (empty→spec-loaded→generating→interface-ready) per data-model.md in src/renderer/stores/tab-store.ts
- [ ] T027 [US1] Create useCli hook — sendMessage (with context), getStatus, restart, streaming response handling via cli:stream-response listener; exposes loading/error states in src/renderer/hooks/use-cli.ts
- [ ] T028 [P] [US1] Implement OpenAPI 3.x parser — use @apidevtools/swagger-parser for validation and $ref dereferencing, transform to NormalizedSpec with endpoints[], models[], securitySchemes[], handle UnresolvedError for external refs by prompting user to provide them manually via a dialog per research.md R3 in src/renderer/services/spec-parser/openapi-parser.ts
- [ ] T029 [P] [US1] Implement Swagger 2.0 parser — use swagger2openapi for 2.0→3.x conversion, then delegate to OpenAPI parser for normalization per research.md R3 in src/renderer/services/spec-parser/swagger-parser.ts
- [ ] T030 [P] [US1] Implement GraphQL schema parser — use graphql package (buildSchema/introspectionFromSchema) + @graphql-tools/schema, transform to NormalizedSpec with queries[], mutations[], subscriptions[], models[] per research.md R3 in src/renderer/services/spec-parser/graphql-parser.ts
- [ ] T031 [US1] Create spec parser facade — format auto-detection (check openapi field → 3.x, swagger field → 2.0, type Query/__schema → GraphQL), delegate to appropriate parser, return NormalizedSpec or validation errors, reject RAML/WSDL with supported-format suggestion in src/renderer/services/spec-parser/index.ts
- [ ] T032 [US1] Implement code validator/sanitizer — scan generated code string for disallowed patterns per FR-034 (eval, Function(), document.cookie, window.parent, window.top, postMessage to non-host origins, Node.js requires), return violations with severity and instance count in src/renderer/services/code-validator/index.ts
- [ ] T033 [US1] Implement code generation orchestrator — coordinate full pipeline: accept NormalizedSpec → send CLI generate request → receive generated code (with streaming) → invoke app:validate-code IPC → invoke app:compile-code IPC → return compiled bundle or error in src/renderer/services/code-generator/index.ts
- [ ] T034 [P] [US1] Create ChatPanel component — virtualized message list using @tanstack/virtual (variable-height items), auto-scroll to bottom on new messages, display user/assistant/system messages, progress indicator during generation in src/renderer/components/chat/ChatPanel.tsx
- [ ] T035 [P] [US1] Create ChatMessage component — render message by role (user, assistant, system), display timestamp, status indicator (sent/pending/queued/error), support attachments display (spec files) in src/renderer/components/chat/ChatMessage.tsx
- [ ] T036 [P] [US1] Create ChatInput component — text input with submit, file upload button (accept .json, .yaml, .yml, .graphql), URL paste detection, drag-and-drop file support, keyboard shortcut (Enter to send, Shift+Enter for newline) in src/renderer/components/chat/ChatInput.tsx
- [ ] T037 [US1] Create sandbox runtime environment — minimal HTML shell with strict CSP (default-src 'none', nonce-based script-src/style-src, connect-src 'self', frame-ancestors 'none') in src/sandbox/index.html; postMessage bridge with nonce verification, message type allowlist, fetch/XHR override for network proxying per sandbox-postmessage-api.md in src/sandbox/bridge.ts; minimal React 19 + ReactDOM runtime mount in src/sandbox/runtime.ts
- [ ] T038 [US1] Create SandboxHost component — manage iframe lifecycle (create, destroy), generate session nonce, handle INIT→READY handshake, relay NETWORK_REQUEST to host proxy, forward RENDER_DATA/THEME_CHANGE/RESIZE messages, handle ERROR (reload with last safe version), log CSP violations to console per sandbox-postmessage-api.md in src/renderer/components/sandbox/SandboxHost.tsx
- [ ] T039 [US1] Create useSandbox hook — abstracts postMessage communication, provides sendToSandbox/onSandboxMessage helpers, manages nonce state, handles RENDER_COMPLETE events, exposes sandbox loading/error status in src/renderer/hooks/use-sandbox.ts
- [ ] T040 [US1] Implement API network proxy — receive proxy:api-request IPC calls, execute HTTP request via Node.js fetch/https, return ProxyAPIResponse with status, headers, body, elapsed time; inject auth headers when available in src/main/proxy/api-proxy.ts
- [ ] T041 [US1] Update App.tsx — implement split-pane layout using react-resizable-panels (30% chat / 70% content, resizable, min/max from constants), render ChatPanel in left pane and SandboxHost in right pane, wire end-to-end flow: user input → spec detection → parse → generate → compile → validate → sandbox render
- [ ] T042 [US1] Add loading states (ProgressBar during spec parsing and UI generation per FR-005/FR-026), error messages (validation failures, unsupported format, generation errors per FR-027), and empty states (no spec loaded call-to-action per FR-028) for all US1 components
- [ ] T043 [US1] Write integration test for full spec-to-interface flow — mock CLI subprocess, provide sample OpenAPI spec, verify parsing → generation → sandbox render completes, verify error display for invalid specs in tests/integration/spec-ingestion.test.tsx

**Checkpoint**: User Story 1 is fully functional — users can open the app, provide an API spec (OpenAPI 3.x, Swagger 2.0, GraphQL), and see a generated interface rendered in a sandboxed iframe. Invalid/unsupported specs show clear error messages. This is the MVP.

---

## Phase 4: User Story 2 — API Authentication & Connection (Priority: P2)

**Goal**: After generating an interface, users configure API credentials (API key, Bearer token, OAuth 2.0) through a guided flow. The generated interface populates with live data. Users can test connections, see status, and re-authenticate when credentials expire.

**Independent Test**: Provide a valid API spec with known credentials, configure authentication through the setup flow, verify live data appears in the generated interface. Test credential expiration detection and re-auth prompt.

### Tests for User Story 2

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T044 [P] [US2] Write unit tests for credential store — in-memory storage with TTL, OS keychain persistence via keytar, per-base-URL scoping, credential retrieval by opaque reference, credential expiration, token refresh in src/main/credentials/credential-store.test.ts
- [ ] T045 [P] [US2] Write unit tests for auth store — connection state management, status transitions (disconnected→connecting→connected→expired), per-base-URL connection tracking in src/renderer/stores/auth-store.test.ts

### Implementation for User Story 2

- [ ] T046 [US2] Implement credential store — in-memory Map<baseUrl, CredentialSet> with TTL auto-cleanup, keytar integration for persistent storage (opt-in), opaque credential references (renderer never sees raw values), token refresh timers (clear 1 min before expiry) per research.md R5 in src/main/credentials/credential-store.ts
- [ ] T047 [US2] Register auth IPC handlers — auth:configure (store credentials per base URL), auth:test-connection (HTTP health check), auth:get-connection-status (return status without raw creds), auth:clear-credentials (remove from memory + optionally keychain), push notifications auth:token-expired and auth:connection-status-changed in src/main/index.ts
- [ ] T048 [US2] Implement OAuth 2.0 PKCE flow — open dedicated BrowserWindow with sandbox:true/nodeIntegration:false, intercept redirect via will-redirect event, exchange code for tokens, store tokens via credential store; register auth:start-oauth-flow IPC handler in src/main/credentials/oauth-flow.ts
- [ ] T049 [US2] Update API proxy to inject authentication headers — before forwarding proxied requests, look up credentials for the target base URL, inject API key header / Bearer token / OAuth access token; handle 401 responses by triggering token refresh and auth:token-expired notification in src/main/proxy/api-proxy.ts
- [ ] T050 [US2] Create auth Zustand store — connections Map<baseUrl, ConnectionStatus>, per-base-URL state tracking, subscribe to auth:token-expired/auth:token-refreshed/auth:connection-status-changed push notifications in src/renderer/stores/auth-store.ts
- [ ] T051 [US2] Create useAuth hook — configure(baseUrl, method), testConnection(baseUrl), getStatus(baseUrl), startOAuthFlow(params), clearCredentials(baseUrl), exposes connection status and loading states in src/renderer/hooks/use-auth.ts
- [ ] T052 [P] [US2] Create AuthSetupFlow component — guided step-by-step flow: select auth method (API Key / Bearer / OAuth 2.0) → enter credentials → test connection → display result; support for all three FR-017 auth methods in src/renderer/components/auth/AuthSetupFlow.tsx
- [ ] T053 [P] [US2] Create ConnectionStatus indicator component — display connection state (connected/degraded/unreachable/expired) with color-coded badge and response time, "Test Connection" button, re-authenticate prompt on expiration per FR-021 in src/renderer/components/auth/ConnectionStatus.tsx
- [ ] T054 [US2] Integrate auth with generated interface — SandboxHost shows placeholder states when unauthenticated (per acceptance scenario 5), populates with live data via proxied requests when connected, displays re-auth prompt on credential expiration without losing interface state
- [ ] T055 [US2] Implement periodic health checks — 5-minute interval background checks per research.md R5, detect 401 → trigger token refresh → notify renderer; update connection status proactively in src/main/credentials/credential-store.ts
- [ ] T056 [US2] Write integration test for auth flow — mock keytar, configure API key auth, verify test-connection success, verify proxied request includes auth header, verify token-expired notification triggers re-auth prompt in tests/integration/auth-flow.test.tsx

**Checkpoint**: Users can configure API authentication and see live data in generated interfaces. Credential expiration is detected and re-auth is prompted without losing interface state.

---

## Phase 5: User Story 3 — Natural Language Interface Customization (Priority: P3)

**Goal**: Users request interface modifications via the chat panel using natural language (e.g., "Add a search bar", "Switch to dark mode", "Show as card grid"). The Copilot CLI processes the request and updates the interface in real time. Requests are queued sequentially per FR-012a.

**Independent Test**: Generate a default interface, issue modification requests via chat, verify each change appears in the sandbox within 15 seconds. Verify ambiguous requests trigger clarification questions.

### Tests for User Story 3

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T057 [P] [US3] Write unit tests for customization queue — FIFO ordering, sequential processing (only one in-progress per tab), failed requests don't block subsequent, status transitions (queued→in-progress→completed/failed), queue depth limits in src/renderer/services/customization-queue.test.ts

### Implementation for User Story 3

- [ ] T058 [US3] Implement customization request queue service — FIFO queue per tab, sequential processing (block new requests while in-flight per FR-012a), status tracking (queued/in-progress/completed/failed), failed request recovery, result version linking in src/renderer/services/customization-queue.ts
- [ ] T059 [US3] Add customize method handling to useCli hook — send CLI customize request with currentCode, prompt, spec context, and chat history per cli-protocol.md; handle streaming response; handle clarification responses (clarificationNeeded: true) in src/renderer/hooks/use-cli.ts
- [ ] T060 [US3] Update ChatPanel to display customization feedback — show confirmation of applied changes and assumptions made, display queued/pending status for waiting requests, render clarification questions with selectable options per FR-011/FR-012 in src/renderer/components/chat/ChatPanel.tsx
- [ ] T061 [US3] Update ChatInput to show queue status — disable submit or show "queued" indicator when a customization is in-flight, display pending request count per FR-012a in src/renderer/components/chat/ChatInput.tsx
- [ ] T062 [US3] Handle clarification flow — when CLI returns clarificationNeeded:true, display question and options in chat, wait for user selection, re-send customize request with user's choice per FR-012
- [ ] T063 [US3] Wire customization pipeline end-to-end — chat input → queue request → CLI customize → receive updated code → compile (app:compile-code) → validate (app:validate-code) → update sandbox → update chat with confirmation; handle conflicts (e.g., "remove X" when X doesn't exist per edge case)
- [ ] T064 [US3] Write integration test for customization flow — generate interface, request customization, verify sandbox updates, verify queue blocks concurrent requests, verify clarification handling in tests/integration/customization.test.tsx

**Checkpoint**: Users can modify generated interfaces using natural language. Requests are queued sequentially, clarifications are handled interactively, and changes appear in real time.

---

## Phase 6: User Story 4 — Interface Version History & Rollback (Priority: P4)

**Goal**: Every interface change (generation, customization, rollback) creates an immutable version snapshot. Users can view chronological version history, see diffs between versions, preview a version, and revert to any previous version in under 3 seconds. Rollbacks create new history entries (no history is lost).

**Independent Test**: Generate an interface, make several customizations, open version history, verify all versions listed with timestamps/descriptions. Revert to an earlier version and verify the interface restores correctly and the revert appears as a new history entry.

### Tests for User Story 4

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T065 [P] [US4] Write unit tests for version database operations — create version, list versions with pagination, load code by version ID, compute diff, rollback creates new entry with isRevert=true, append-only constraint, version number ascending in src/main/versions/version-db.test.ts
- [ ] T066 [P] [US4] Write unit tests for version manager service — save snapshot, list versions, load version code, compute diff, rollback flow in src/renderer/services/version-manager/version-manager.test.ts

### Implementation for User Story 4

- [ ] T067 [US4] Create SQLite version database — initialize better-sqlite3 database at {userData}/versions.db, create versions table schema (id, interface_id, version_number, parent_version_id, is_revert, reverted_from_id, created_at, description, change_type, code_path, code_hash, generation_prompt) per research.md R4, filesystem code storage at {userData}/interfaces/{id}/versions/v{n}/generated.tsx in src/main/versions/version-db.ts
- [ ] T068 [US4] Register versions IPC handlers — versions:save-snapshot (write code to filesystem, insert metadata to SQLite, compute SHA-256 hash), versions:list (paginated query), versions:load-code (read from filesystem), versions:get-diff (compute diff via diff-match-patch with LRU cache of 20) in src/main/index.ts
- [ ] T069 [US4] Create version Zustand store — versions list per interface, currentVersionId, loading states for list/load/diff operations, subscribe to version changes in src/renderer/stores/version-store.ts
- [ ] T070 [US4] Create useVersions hook — saveSnapshot, listVersions, loadVersionCode, getDiff, rollbackToVersion; exposes version list and loading states in src/renderer/hooks/use-versions.ts
- [ ] T071 [US4] Implement version manager service — orchestrate version CRUD via IPC, auto-save snapshots on generation and customization events, rollback creates new version entry pointing to target version's code file per FR-016 in src/renderer/services/version-manager/index.ts
- [ ] T072 [P] [US4] Create VersionTimeline component — chronological list of versions with timestamp, change type icon (generation/customization/rollback), description, "Revert" button per version; highlight current active version in src/renderer/components/version-history/VersionTimeline.tsx
- [ ] T073 [P] [US4] Create VersionDiffViewer component — side-by-side or inline diff display of two versions using diff-match-patch output, additions/deletions count, line-by-line highlighting in src/renderer/components/version-history/VersionDiffViewer.tsx
- [ ] T074 [US4] Implement rollback flow — select version → preview diff → confirm revert → create new version entry (isRevert=true, code copied from target) → reload sandbox with reverted code → display revert confirmation in chat; warn if reverted version depends on uninstalled plugin per edge case
- [ ] T075 [US4] Auto-create version snapshots — hook into code generation (US1) and customization (US3) completion events to automatically save version snapshots with appropriate changeType and description; initial generation = v1
- [ ] T076 [US4] Write integration test for version history — generate interface, customize twice, verify 3 versions in history, revert to v1, verify v4 exists with isRevert=true, verify sandbox shows v1 code, verify diff between v1 and v3 in tests/integration/version-history.test.tsx

**Checkpoint**: Full version history and rollback working. Every change creates a version. Users can browse history, view diffs, and revert to any version in under 3 seconds. No history is ever lost.

---

## Phase 7: User Story 5 — Multi-API Tab Management (Priority: P5)

**Goal**: Users can create multiple tabs, each holding an independent API interface with its own spec, auth, chat history, versions, and customizations. Tabs can be created, closed (with confirmation), renamed, reordered via drag-and-drop, and switched between. Tabs sharing the same API base URL share credentials.

**Independent Test**: Create tabs for two different API specs, customize each independently, switch between them and verify state isolation. Connect two tabs to the same API base URL and verify credential sharing. Verify 10 concurrent tabs remain responsive.

### Tests for User Story 5

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T077 [P] [US5] Write unit tests for multi-tab store — create tab, close tab, switch tab, rename tab, reorder tabs, tab state isolation (each tab has own spec/interface/chat), activeTabId management, close confirmation trigger in src/renderer/stores/tab-store.test.ts

### Implementation for User Story 5

- [ ] T078 [US5] Upgrade tab store to full multi-tab support — Tab[] array, activeTabId, createTab, closeTab, switchTab, renameTab, reorderTab, per-tab state isolation (apiSpec, generatedInterface, chatHistory, customizationQueue, consoleEntries are independent per tab) in src/renderer/stores/tab-store.ts
- [ ] T079 [US5] Create useTabs hook — createTab, closeTab (with unsaved-work check), switchTab, renameTab, reorderTab, getActiveTab, tabCount; expose tab list and active tab state in src/renderer/hooks/use-tabs.ts
- [ ] T080 [P] [US5] Create TabBar component — horizontal tab strip with overflow scroll, tab indicators (active/inactive), "+" new tab button, close button per tab, @dnd-kit/core drag reorder, double-click to rename in src/renderer/components/tabs/TabBar.tsx
- [ ] T081 [P] [US5] Create TabItem component — tab label with truncation, close button, active/inactive styling, drag handle, rename inline editing, unsaved indicator in src/renderer/components/tabs/TabItem.tsx
- [ ] T082 [US5] Implement tab close with confirmation — when closing a tab with a loaded spec or customized interface, show confirmation dialog before discarding state per acceptance scenario 3 in src/renderer/components/tabs/TabBar.tsx
- [ ] T083 [US5] Wire per-tab state isolation in App.tsx — render the active tab's ChatPanel, SandboxHost, and version history; switching tabs swaps all panel content while preserving each tab's independent state
- [ ] T084 [US5] Implement per-base-URL credential sharing — when two tabs connect to the same API base URL, auth-store shares one APIConnection; re-authenticating in one tab updates all tabs using that base URL per FR-020 and data-model.md APIConnection.tabIds in src/renderer/stores/auth-store.ts
- [ ] T085 [US5] Write integration test for multi-tab — create 3 tabs with different specs, customize each, switch between, verify state isolation; connect 2 tabs to same base URL, verify shared credentials; close tab with confirmation in tests/integration/multi-tab.test.tsx

**Checkpoint**: Multi-tab support working. Each tab is fully independent. Credential sharing works per base URL. 10+ tabs remain responsive (tab switch < 200ms per performance goals).

---

## Phase 8: User Story 6 — Debug Console (Priority: P6)

**Goal**: Users can open a toggleable console panel that displays raw API request/response data (method, URL, headers, body, status, timing). Console supports search, filtering by status code/URL/keyword, and clear. Console captures all proxied API requests and sandbox LOG messages.

**Independent Test**: Connect to a live API, trigger requests through the generated interface, open the console, verify request/response entries appear with full detail. Test filtering by status code and keyword search.

### Tests for User Story 6

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T086 [P] [US6] Write unit tests for console filtering — filter by status code, filter by URL pattern, keyword search across request/response body, combined filters, clear all entries in src/renderer/components/console/console-filter.test.ts

### Implementation for User Story 6

- [ ] T087 [US6] Extend tab store with console entries — add ConsoleEntry[] per tab, add/clear operations, capture entry from proxy response data in src/renderer/stores/tab-store.ts
- [ ] T088 [P] [US6] Create ConsolePanel component — toggleable panel (bottom of content area), virtual-scrolled entry list using @tanstack/virtual (fixed-height entries), search input, status code filter dropdown, URL pattern filter, "Clear" button, entry count indicator in src/renderer/components/console/ConsolePanel.tsx
- [ ] T089 [P] [US6] Create ConsoleEntry component — display HTTP method badge, URL, status code (color-coded), elapsed time, expandable sections for request headers/body and response headers/body with highlight.js syntax highlighting for JSON in src/renderer/components/console/ConsoleEntry.tsx
- [ ] T090 [US6] Implement console filtering logic — filter by status code range (2xx, 3xx, 4xx, 5xx), filter by URL pattern (substring/regex), keyword search across method+URL+body via useMemo + regex, combined filter AND logic in src/renderer/components/console/use-console-filter.ts
- [ ] T091 [US6] Wire console entry capture — intercept all proxy:api-request IPC responses and create ConsoleEntry records, capture sandbox LOG messages via postMessage bridge, record elapsed time per request in src/renderer/hooks/use-sandbox.ts and src/renderer/hooks/use-auth.ts
- [ ] T092 [US6] Integrate console panel into App layout — add toggleable bottom panel (consoleVisible from app-store), keyboard shortcut to toggle (Ctrl/Cmd+J), per-tab console entries display in src/renderer/App.tsx
- [ ] T093 [US6] Write integration test for debug console — mock API requests, verify console entries appear with correct method/URL/status/timing, verify filtering works, verify clear removes all entries in tests/integration/debug-console.test.tsx

**Checkpoint**: Debug console panel working. All API requests are logged with full request/response detail. Filtering and search work. Console operates per-tab independently.

---

## Phase 9: User Story 7 — Tool & Plugin Installation (Priority: P7)

**Goal**: Users can install, configure, and uninstall tools/plugins (including MCP servers). Installed tools extend Copilot CLI capabilities during generation and customization. Users can browse installed tools, see status/version, and manage dependencies.

**Independent Test**: Install a sample MCP server plugin, verify it appears in the installed tools list with correct version/status. Verify the CLI can access the plugin's capabilities. Uninstall the plugin and verify dependent interfaces show a warning.

### Tests for User Story 7

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T094 [P] [US7] Write unit tests for plugin manager — install from path/reference, track status lifecycle (installing→installed/error), list installed plugins, uninstall with dependency check, capability registration in src/main/plugins/plugin-manager.test.ts

### Implementation for User Story 7

- [ ] T095 [US7] Implement plugin manager — install plugin from package reference or path, track lifecycle (installing→installed/error→uninstalling), store plugin metadata (name, type, version, capabilities, installPath, configPath), list installed plugins, uninstall with cleanup, emit status-changed notifications per FR-022/FR-024 in src/main/plugins/plugin-manager.ts
- [ ] T096 [US7] Register plugins IPC handlers — plugins:install (invoke plugin manager), plugins:uninstall (with force flag for dependency override), plugins:list (return all installed), push notification plugins:status-changed with progress percentage in src/main/index.ts
- [ ] T097 [US7] Create plugin Zustand store — installed plugins list, installation progress tracking, subscribe to plugins:status-changed push notifications in src/renderer/stores/plugin-store.ts
- [ ] T098 [P] [US7] Create PluginList component — display installed tools with name, type, version, status badge, capabilities list, "Uninstall" button, "Configure" button; "Install New" action button in src/renderer/components/plugins/PluginList.tsx
- [ ] T099 [P] [US7] Create PluginInstallDialog component — input for package reference or file path, plugin type selector (mcp-server/transformer/integration), optional name override, install button with progress indicator, success/error result display in src/renderer/components/plugins/PluginInstallDialog.tsx
- [ ] T100 [US7] Implement uninstall with dependency warnings — check dependentInterfaces before uninstall per FR-025, show warning dialog listing affected interfaces, require force confirmation to proceed in src/renderer/components/plugins/PluginList.tsx
- [ ] T101 [US7] Wire plugin capabilities to CLI — include installed plugin list in CLI context for generate/customize calls, display missing-plugin warnings when reverting to a version with uninstalled plugin dependencies per edge case
- [ ] T102 [US7] Write integration test for plugin lifecycle — install mock plugin, verify appears in list with correct metadata, verify CLI receives plugin context, uninstall with dependent interface warning, verify post-uninstall state in tests/integration/plugin-lifecycle.test.tsx

**Checkpoint**: Plugin management working. Users can install/configure/uninstall tools. CLI leverages installed plugin capabilities. Dependency warnings appear on uninstall and version rollback.

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories — accessibility, performance, CI, and end-to-end validation.

- [ ] T103 [P] Audit and enforce WCAG 2.1 AA compliance across all components — semantic HTML, ARIA attributes, keyboard navigation (tab order, focus management, arrow key navigation for tabs/lists), sufficient color contrast, focus-visible indicators, screen reader labels for all interactive elements
- [ ] T104 [P] Add axe-core accessibility tests for all user-facing components — ChatPanel, SandboxHost, AuthSetupFlow, VersionTimeline, TabBar, ConsolePanel, PluginList, all common primitives; zero critical/serious violations gate in tests/unit/a11y/
- [ ] T105 Implement CLI unavailability UX — persistent status indicator showing CLI state (running/restarting/stopped) per FR-029, automatic restart on crash, queue user requests during recovery, display recovery notification in src/renderer/components/common/CLIStatusBadge.tsx
- [ ] T106 Performance optimization — lazy-load spec parser modules (dynamic import for swagger-parser, swagger2openapi, graphql), virtualize chat and console lists (verify @tanstack/virtual), apply React.memo/useMemo/useCallback where profiling shows benefit, verify tab switch < 200ms and LCP < 2.5s
- [ ] T107 Configure CI pipeline — GitHub Actions workflow with lint (zero errors/warnings), type-check (strict), test (coverage ≥80%), build, bundle-size tracking, axe-core accessibility gate, Playwright E2E in .github/workflows/ci.yml
- [ ] T108 Run quickstart.md validation — execute all development commands (dev, test, lint, format, type-check, build), verify sample spec ingestion end-to-end, verify auth flow, verify customization, verify version rollback, verify multi-tab, verify console, verify plugin install/uninstall
- [ ] T109 [P] Implement progressive rendering for large API specs — section-based lazy loading of endpoints (20 per page per research.md R3), section navigation sidebar, virtualized endpoint list for specs with 50+ endpoints in src/renderer/components/sandbox/ and src/renderer/services/code-generator/
- [ ] T110 [P] Create external $ref resolution dialog — when parser encounters UnresolvedError for external references, display a modal prompting the user to provide the missing schema content manually (paste or file upload); feed resolved refs back to parser and retry in src/renderer/components/common/ExternalRefDialog.tsx
- [ ] T111 [P] Validate SC-004 (first-time user success) — conduct heuristic UX evaluation of onboarding flow, verify 90% of first-time users can ingest a spec and view generated UI without guidance; document findings and remediate critical issues
- [ ] T112 [P] Validate SC-006 (auth-to-live-data timing) — add E2E timing assertions to auth integration tests verifying that a user can go from opening auth setup to seeing live API data within 2 minutes in tests/e2e/auth-timing.spec.ts
- [ ] T113 [P] Validate SC-008 (actionable error messages) — enumerate all connection failure scenarios (DNS failure, timeout, TLS error, 4xx, 5xx, malformed response) and verify each displays an actionable error message with suggested resolution in tests/integration/error-messages.test.tsx
- [ ] T114 [P] Validate SC-010 (rollback discoverability) — verify version rollback feature is discoverable within 30 seconds by a user unfamiliar with the feature; verify clear visual affordances and tooltips in tests/e2e/rollback-discoverability.spec.ts
- [ ] T115 [P] Add visual regression tests for design-system components — screenshot-based comparison tests for all common primitives (Button, Modal, Dialog, StatusBadge, TabBar, etc.) using Playwright visual comparisons in tests/e2e/visual-regression/

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **User Stories (Phase 3–9)**: All depend on Foundational phase completion
  - User stories can proceed in parallel (if staffed) or sequentially in priority order
  - Some user stories have soft dependencies (see below)
- **Polish (Phase 10)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) — No dependencies on other stories. **This is the MVP.**
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) — Soft dependency on US1 (uses generated interface to display live data, but auth components can be built independently)
- **User Story 3 (P3)**: Depends on US1 completion — requires generated interface to exist for customization to apply changes
- **User Story 4 (P4)**: Can start after Foundational (Phase 2) — IPC/storage can be built independently, but integration requires US1 (generation) and benefits from US3 (customization creates versions)
- **User Story 5 (P5)**: Soft dependency on US1 — tab management can be built independently but needs generated interfaces for meaningful testing
- **User Story 6 (P6)**: Depends on US2 — console captures API proxy requests, which require auth/connection infrastructure
- **User Story 7 (P7)**: Can start after Foundational (Phase 2) — plugin manager is independent, but CLI integration requires US1

### Within Each User Story

1. Tests MUST be written and FAIL before implementation (Red-Green-Refactor)
2. Backend/main process logic before renderer services
3. Stores before hooks
4. Hooks before components
5. Core implementation before integration wiring
6. Integration test last (validates the full story flow)

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel (T003, T004, T006)
- All Foundational tasks marked [P] can run in parallel (T008, T009, T013, T014, T016)
- All test tasks within a user story marked [P] can run in parallel
- Spec parsers (T028, T029, T030) are fully independent — run in parallel
- Chat components (T034, T035, T036) are fully independent — run in parallel
- Auth components (T052, T053) are independent
- Version history components (T072, T073) are independent
- Tab components (T080, T081) are independent
- Console components (T088, T089) are independent
- Plugin components (T098, T099) are independent
- Once Foundational completes, US1, US2 (partially), US4 (storage layer), US5 (tab UI), and US7 (plugin manager) can be started in parallel by different developers

---

## Parallel Example: User Story 1

```bash
# Launch all US1 tests in parallel (must all fail initially):
Task T017: "Unit tests for CLI protocol in src/main/cli/cli-protocol.test.ts"
Task T018: "Unit tests for spec parser in src/renderer/services/spec-parser/spec-parser.test.ts"
Task T019: "Unit tests for code validator in src/renderer/services/code-validator/code-validator.test.ts"
Task T020: "Unit tests for sandbox bridge in src/sandbox/bridge.test.ts"

# Launch all spec parsers in parallel (after T031 facade is planned but independent implementations):
Task T028: "OpenAPI 3.x parser in src/renderer/services/spec-parser/openapi-parser.ts"
Task T029: "Swagger 2.0 parser in src/renderer/services/spec-parser/swagger-parser.ts"
Task T030: "GraphQL parser in src/renderer/services/spec-parser/graphql-parser.ts"

# Launch all chat components in parallel:
Task T034: "ChatPanel in src/renderer/components/chat/ChatPanel.tsx"
Task T035: "ChatMessage in src/renderer/components/chat/ChatMessage.tsx"
Task T036: "ChatInput in src/renderer/components/chat/ChatInput.tsx"
```

## Parallel Example: User Story 4

```bash
# Launch version history components in parallel:
Task T072: "VersionTimeline in src/renderer/components/version-history/VersionTimeline.tsx"
Task T073: "VersionDiffViewer in src/renderer/components/version-history/VersionDiffViewer.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001–T006)
2. Complete Phase 2: Foundational (T007–T016)
3. Complete Phase 3: User Story 1 (T017–T043)
4. **STOP and VALIDATE**: Test User Story 1 independently — provide sample specs, verify generated interfaces render correctly
5. Deploy/demo if ready — this delivers the core value proposition

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → **Deploy/Demo (MVP!)**
3. Add User Story 2 → Test independently → Deploy/Demo (live API data)
4. Add User Story 3 → Test independently → Deploy/Demo (customization)
5. Add User Story 4 → Test independently → Deploy/Demo (version safety net)
6. Add User Story 5 → Test independently → Deploy/Demo (multi-API workflow)
7. Add User Story 6 → Test independently → Deploy/Demo (debugging)
8. Add User Story 7 → Test independently → Deploy/Demo (extensibility)
9. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (MVP — highest priority)
   - Developer B: User Story 4 storage layer (T067–T068, independent backend)
   - Developer C: User Story 7 plugin manager (T095–T096, independent backend)
3. After US1 completes:
   - Developer A: User Story 2 (needs US1 for integration)
   - Developer B: User Story 4 UI + integration (needs US1)
   - Developer C: User Story 5 (needs US1 for meaningful tabs)
4. After US2 completes:
   - Developer A: User Story 3 (needs US1)
   - Developer B: User Story 6 (needs US2 for API requests)
5. Stories integrate and validate independently

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks in the same phase
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Tests are mandatory per constitution — write failing tests before implementing
- Verify tests fail (Red) → implement (Green) → refactor
- Commit after each task or logical group using conventional commits
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same-file conflicts, cross-story dependencies that break independence
- All generated code rendered in sandboxed iframe — never in host DOM (FR-030)
- Credentials never exposed to renderer process — opaque references only (security constraint)
- CLI communication via main process IPC only — renderer never spawns processes
- File size limit: 300 lines per file per constitution — refactor if exceeded
