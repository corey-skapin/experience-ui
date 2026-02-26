# Data Model: API-Driven UI Generator

**Feature Branch**: `001-api-ui-generator`
**Date**: 2025-07-24
**Derived from**: [spec.md](spec.md) Key Entities + [research.md](research.md)

---

## Entity Relationship Diagram

```text
┌──────────────┐     1   ┌──────────────┐     *   ┌──────────────────┐
│  Application │────────▶│     Tab      │────────▶│ InterfaceVersion │
│    State     │         │              │         │                  │
└──────────────┘         └──────┬───────┘         └──────────────────┘
       │                       │ 1                        │
       │ 1                     ▼                          │ belongs to
       ▼                 ┌──────────────┐                 ▼
┌──────────────┐         │  Generated   │          ┌──────────────┐
│  CLI State   │         │  Interface   │◀─────────│  API Spec    │
│              │         └──────┬───────┘          │              │
└──────────────┘               │ *..1              └──────────────┘
       │                       ▼
       │                 ┌──────────────┐
       │                 │    API       │◀── shared per base URL
       │                 │  Connection  │
       │                 └──────────────┘
       │
       │ *               ┌──────────────┐
       └────────────────▶│ Tool/Plugin  │
                         │              │
                         └──────────────┘
```

---

## Entities

### 1. ApplicationState

Top-level singleton representing the entire application runtime state. Managed by Zustand root store.

| Field            | Type                | Required | Description                               |
| ---------------- | ------------------- | -------- | ----------------------------------------- |
| `tabs`           | `Tab[]`             | Yes      | All open tabs                             |
| `activeTabId`    | `string \| null`    | Yes      | Currently focused tab                     |
| `cliState`       | `CLIState`          | Yes      | Copilot CLI subprocess status             |
| `plugins`        | `Plugin[]`          | Yes      | Installed tools/plugins                   |
| `theme`          | `'light' \| 'dark'` | Yes      | Active color theme                        |
| `chatPanelWidth` | `number`            | Yes      | Chat panel width percentage (default: 30) |
| `consoleVisible` | `boolean`           | Yes      | Debug console panel visibility            |

**Validation Rules**:

- `activeTabId` MUST reference an existing tab or be `null` when no tabs exist
- `chatPanelWidth` MUST be between 15 and 85 (percent)

---

### 2. Tab

A workspace container holding one generated interface and its associated state. Each tab is independent.

| Field                | Type                         | Required | Description                              |
| -------------------- | ---------------------------- | -------- | ---------------------------------------- |
| `id`                 | `string`                     | Yes      | Unique identifier (UUID v4)              |
| `title`              | `string`                     | Yes      | User-visible tab label                   |
| `displayOrder`       | `number`                     | Yes      | Position in tab bar                      |
| `isActive`           | `boolean`                    | Yes      | Whether this tab is currently focused    |
| `apiSpec`            | `APISpec \| null`            | No       | Loaded API specification                 |
| `generatedInterface` | `GeneratedInterface \| null` | No       | Active generated UI                      |
| `connectionId`       | `string \| null`             | No       | Reference to APIConnection (by base URL) |
| `chatHistory`        | `ChatMessage[]`              | Yes      | Chat messages for this tab               |
| `customizationQueue` | `CustomizationRequest[]`     | Yes      | Pending customization requests           |
| `createdAt`          | `DateTime`                   | Yes      | Tab creation timestamp                   |

**Validation Rules**:

- `title` MUST be 1–100 characters
- `displayOrder` MUST be unique across all tabs
- `customizationQueue` MUST be processed sequentially (FIFO)

**State Transitions**:

```text
empty → spec-loaded → generating → interface-ready → customizing → interface-ready
                                                    ↓
                                              error (recoverable)
```

---

### 3. APISpec

A parsed and validated API specification provided by the user.

| Field              | Type                                    | Required | Description                           |
| ------------------ | --------------------------------------- | -------- | ------------------------------------- |
| `id`               | `string`                                | Yes      | Unique identifier                     |
| `format`           | `'openapi3' \| 'swagger2' \| 'graphql'` | Yes      | Detected specification format         |
| `source`           | `SpecSource`                            | Yes      | How the spec was provided             |
| `rawContent`       | `string`                                | Yes      | Original specification text           |
| `normalizedSpec`   | `NormalizedSpec`                        | Yes      | Parsed and normalized representation  |
| `validationStatus` | `'valid' \| 'invalid' \| 'warnings'`    | Yes      | Validation outcome                    |
| `validationErrors` | `ValidationError[]`                     | No       | List of validation issues             |
| `metadata`         | `SpecMetadata`                          | Yes      | Extracted title, version, description |
| `parsedAt`         | `DateTime`                              | Yes      | When the spec was parsed              |

**Sub-types**:

```typescript
type SpecSource =
  | { type: 'file'; fileName: string; filePath: string }
  | { type: 'url'; url: string }
  | { type: 'text' };

interface SpecMetadata {
  title: string;
  version: string;
  description?: string;
  baseUrl?: string;
}

interface ValidationError {
  path: string; // JSON pointer to the error location
  message: string; // Human-readable error description
  severity: 'error' | 'warning';
}
```

**Validation Rules**:

- `format` MUST be one of the three supported values; RAML/WSDL MUST be rejected with an actionable error
- `normalizedSpec` MUST contain at least one endpoint (REST) or one query/mutation (GraphQL); specs with no operations MUST trigger FR-004 empty-content handling
- `rawContent` maximum size: 50MB

---

### 4. NormalizedSpec

Unified internal representation of any parsed API specification. Enables format-agnostic UI generation.

| Field             | Type                                    | Required    | Description                            |
| ----------------- | --------------------------------------- | ----------- | -------------------------------------- |
| `format`          | `'openapi3' \| 'swagger2' \| 'graphql'` | Yes         | Original format                        |
| `metadata`        | `SpecMetadata`                          | Yes         | Title, version, description, base URL  |
| `endpoints`       | `NormalizedEndpoint[]`                  | Conditional | REST API endpoints (OpenAPI/Swagger)   |
| `queries`         | `NormalizedOperation[]`                 | Conditional | GraphQL queries                        |
| `mutations`       | `NormalizedOperation[]`                 | Conditional | GraphQL mutations                      |
| `subscriptions`   | `NormalizedOperation[]`                 | Conditional | GraphQL subscriptions                  |
| `models`          | `NormalizedModel[]`                     | Yes         | Data schemas/types                     |
| `securitySchemes` | `SecurityScheme[]`                      | No          | Authentication methods defined in spec |
| `tags`            | `string[]`                              | No          | Grouping tags for endpoints            |

**Sub-types**:

```typescript
interface NormalizedEndpoint {
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';
  operationId?: string;
  summary?: string;
  description?: string;
  tag?: string;
  parameters: NormalizedParameter[];
  requestBody?: NormalizedModel;
  responses: Record<string, NormalizedResponseModel>;
  securityRequirements?: string[];
  deprecated?: boolean;
}

interface NormalizedParameter {
  name: string;
  in: 'path' | 'query' | 'header' | 'cookie';
  type: string;
  required: boolean;
  description?: string;
  schema?: NormalizedModel;
}

interface NormalizedResponseModel {
  statusCode: string;
  description: string;
  schema?: NormalizedModel;
}

interface NormalizedOperation {
  name: string;
  type: 'query' | 'mutation' | 'subscription';
  description?: string;
  args: NormalizedParameter[];
  returnType: NormalizedModel;
  deprecated?: boolean;
}

interface NormalizedModel {
  name: string;
  type:
    | 'object'
    | 'array'
    | 'string'
    | 'number'
    | 'integer'
    | 'boolean'
    | 'null'
    | 'enum'
    | 'union';
  description?: string;
  properties?: Record<string, NormalizedModel>;
  items?: NormalizedModel; // For arrays
  required?: string[]; // Required properties
  enumValues?: string[]; // For enums
  unionOf?: NormalizedModel[]; // For union/oneOf types
  format?: string; // e.g., 'date-time', 'email', 'uri'
  default?: unknown;
  example?: unknown;
}

interface SecurityScheme {
  name: string;
  type: 'apiKey' | 'oauth2' | 'http';
  in?: 'header' | 'query' | 'cookie';
  scheme?: string; // e.g., 'bearer'
  flows?: OAuthFlows;
  description?: string;
}
```

**Validation Rules**:

- REST specs MUST have at least one entry in `endpoints`
- GraphQL specs MUST have at least one entry in `queries` or `mutations`
- All `NormalizedModel` references MUST resolve (no dangling references)

---

### 5. GeneratedInterface

An automatically created visual representation of an API spec, produced as compiled React/HTML/CSS source code and rendered in a sandboxed iframe.

| Field              | Type                 | Required | Description                    |
| ------------------ | -------------------- | -------- | ------------------------------ |
| `id`               | `string`             | Yes      | Unique identifier              |
| `tabId`            | `string`             | Yes      | Owning tab reference           |
| `apiSpecId`        | `string`             | Yes      | Source API spec reference      |
| `currentVersionId` | `string`             | Yes      | Active version being displayed |
| `versions`         | `InterfaceVersion[]` | Yes      | Complete version history       |
| `sandboxState`     | `SandboxState`       | Yes      | Current sandbox iframe status  |
| `createdAt`        | `DateTime`           | Yes      | Initial generation timestamp   |

**Sub-types**:

```typescript
type SandboxState =
  | { status: 'idle' }
  | { status: 'loading'; progress: number }
  | { status: 'active'; iframeRef: string }
  | { status: 'error'; error: string; lastSafeVersionId: string };
```

**Validation Rules**:

- `versions` MUST contain at least one entry (the initial generation)
- `currentVersionId` MUST reference an existing version in `versions`
- On sandbox error, system MUST fall back to `lastSafeVersionId`

---

### 6. InterfaceVersion

An immutable snapshot of a generated interface at a specific point in time. Versions form an append-only chain.

| Field                   | Type                                            | Required | Description                            |
| ----------------------- | ----------------------------------------------- | -------- | -------------------------------------- |
| `id`                    | `string`                                        | Yes      | Unique identifier (e.g., `v{number}`)  |
| `interfaceId`           | `string`                                        | Yes      | Parent GeneratedInterface              |
| `versionNumber`         | `number`                                        | Yes      | Sequential version number              |
| `parentVersionId`       | `string \| null`                                | No       | Previous version (null for initial)    |
| `changeType`            | `'generation' \| 'customization' \| 'rollback'` | Yes      | What created this version              |
| `description`           | `string`                                        | Yes      | Human-readable change description      |
| `generationPrompt`      | `string \| null`                                | No       | Chat input that triggered this version |
| `codePath`              | `string`                                        | Yes      | Filesystem path to generated source    |
| `codeHash`              | `string`                                        | Yes      | SHA-256 hash of generated code         |
| `isRevert`              | `boolean`                                       | Yes      | Whether this is a rollback entry       |
| `revertedFromVersionId` | `string \| null`                                | No       | Target version if `isRevert` is true   |
| `pluginDependencies`    | `string[]`                                      | No       | Plugin IDs this version relies on      |
| `createdAt`             | `DateTime`                                      | Yes      | Snapshot timestamp                     |

**Validation Rules**:

- `versionNumber` MUST be strictly ascending within an interface
- `codeHash` MUST match the SHA-256 of the file at `codePath`
- Rollback entries MUST have `isRevert = true` and a valid `revertedFromVersionId`
- History is append-only: versions MUST NOT be deleted or modified after creation (FR-016)

**State Transitions** (Version Lifecycle):

```text
[User provides spec] → generation → v1 (initial)
[User requests change] → customization → v2
[User requests change] → customization → v3
[User reverts to v1] → rollback → v4 (code = v1 code, isRevert = true)
[User requests change] → customization → v5
```

**Persistence**: Stored in SQLite (`versions` table) + filesystem (code files). See research.md R4 for schema.

---

### 7. APIConnection

Authentication and connectivity configuration for a live API. Scoped per API base URL — multiple tabs sharing the same base URL share one connection.

| Field            | Type               | Required | Description                        |
| ---------------- | ------------------ | -------- | ---------------------------------- |
| `id`             | `string`           | Yes      | Unique identifier                  |
| `baseUrl`        | `string`           | Yes      | Identity key: scheme + host + port |
| `authMethod`     | `AuthMethod`       | Yes      | Authentication configuration       |
| `status`         | `ConnectionStatus` | Yes      | Current connection state           |
| `lastVerifiedAt` | `DateTime \| null` | No       | Last successful health check       |
| `responseTimeMs` | `number \| null`   | No       | Last health check response time    |
| `tabIds`         | `string[]`         | Yes      | Tabs using this connection         |

**Sub-types**:

```typescript
type AuthMethod =
  | { type: 'none' }
  | { type: 'apiKey'; headerName: string; keyRef: string }
  | { type: 'bearer'; tokenRef: string }
  | {
      type: 'oauth2';
      clientId: string;
      authEndpoint: string;
      tokenEndpoint: string;
      scopes: string[];
      tokenRef: string;
      refreshTokenRef: string;
    };

type ConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'degraded'
  | 'expired'
  | 'unreachable';

// Note: keyRef/tokenRef are opaque references to credentials stored in
// the main process credential store (keytar/in-memory). The renderer
// process NEVER has direct access to credential values.
```

**Validation Rules**:

- `baseUrl` MUST be a valid URL with scheme + host (port optional)
- `baseUrl` is the identity key: two connections with the same `baseUrl` are the same connection
- `tabIds` MUST reference existing tabs; empty `tabIds` triggers connection cleanup
- Credential references (`keyRef`, `tokenRef`) MUST resolve in the main process credential store
- Re-authenticating in one tab MUST update all tabs sharing the same `baseUrl`

**State Transitions**:

```text
disconnected → connecting → connected
                         → unreachable (network error)
                         → expired (401 response)
connected → degraded (slow response / partial failures)
         → expired (token expiration detected)
         → unreachable (connection lost)
expired → connecting (re-authentication initiated)
unreachable → connecting (retry initiated)
```

---

### 8. CLIState

Represents the status of the embedded Copilot CLI subprocess.

| Field             | Type                                                                | Required | Description                           |
| ----------------- | ------------------------------------------------------------------- | -------- | ------------------------------------- |
| `status`          | `'stopped' \| 'starting' \| 'running' \| 'crashed' \| 'restarting'` | Yes      | Current subprocess state              |
| `pid`             | `number \| null`                                                    | No       | Process ID when running               |
| `lastCrashAt`     | `DateTime \| null`                                                  | No       | Timestamp of last crash               |
| `restartCount`    | `number`                                                            | Yes      | Consecutive restart attempts          |
| `pendingRequests` | `number`                                                            | Yes      | Queued requests awaiting CLI recovery |
| `errorMessage`    | `string \| null`                                                    | No       | Last error message from CLI           |

**Validation Rules**:

- `pid` MUST be set when `status` is `'running'`
- `restartCount` resets to 0 when CLI transitions to `'running'`
- After 5 consecutive restart failures, system MUST surface a persistent error to the user

**State Transitions**:

```text
stopped → starting → running
                   → crashed → restarting → running
                                          → crashed (max retries → stopped with error)
running → crashed → restarting
```

---

### 9. Plugin

An installed extension providing additional capabilities to the CLI and generated interfaces.

| Field                 | Type                                                       | Required | Description                              |
| --------------------- | ---------------------------------------------------------- | -------- | ---------------------------------------- |
| `id`                  | `string`                                                   | Yes      | Unique identifier                        |
| `name`                | `string`                                                   | Yes      | Display name                             |
| `type`                | `'mcp-server' \| 'transformer' \| 'integration'`           | Yes      | Plugin category                          |
| `version`             | `string`                                                   | Yes      | Installed version (semver)               |
| `status`              | `'installed' \| 'installing' \| 'error' \| 'uninstalling'` | Yes      | Lifecycle state                          |
| `configPath`          | `string \| null`                                           | No       | Path to plugin configuration file        |
| `capabilities`        | `string[]`                                                 | Yes      | What the plugin provides                 |
| `installPath`         | `string`                                                   | Yes      | Filesystem path to installed plugin      |
| `installedAt`         | `DateTime`                                                 | Yes      | Installation timestamp                   |
| `dependentInterfaces` | `string[]`                                                 | No       | Interface IDs actively using this plugin |
| `errorMessage`        | `string \| null`                                           | No       | Last error if status is `'error'`        |

**Validation Rules**:

- `name` MUST be 1–100 characters
- `version` MUST be valid semver
- Uninstalling a plugin with non-empty `dependentInterfaces` MUST trigger a warning (FR-025)
- Reverting to a version with a dependency on an uninstalled plugin MUST display a warning

---

### 10. ChatMessage

A single message in the chat panel conversation.

| Field              | Type                                         | Required | Description                               |
| ------------------ | -------------------------------------------- | -------- | ----------------------------------------- |
| `id`               | `string`                                     | Yes      | Unique identifier                         |
| `tabId`            | `string`                                     | Yes      | Owning tab                                |
| `role`             | `'user' \| 'assistant' \| 'system'`          | Yes      | Message sender                            |
| `content`          | `string`                                     | Yes      | Message text content                      |
| `timestamp`        | `DateTime`                                   | Yes      | When the message was sent                 |
| `status`           | `'sent' \| 'pending' \| 'queued' \| 'error'` | Yes      | Delivery status                           |
| `attachments`      | `MessageAttachment[]`                        | No       | Attached files or specs                   |
| `relatedVersionId` | `string \| null`                             | No       | Interface version created by this message |

**Sub-types**:

```typescript
interface MessageAttachment {
  type: 'spec-file' | 'image' | 'code-snippet';
  name: string;
  content: string;
  mimeType: string;
}
```

---

### 11. CustomizationRequest

A queued request for natural language interface modification.

| Field             | Type                                                   | Required | Description                        |
| ----------------- | ------------------------------------------------------ | -------- | ---------------------------------- |
| `id`              | `string`                                               | Yes      | Unique identifier                  |
| `tabId`           | `string`                                               | Yes      | Target tab                         |
| `prompt`          | `string`                                               | Yes      | User's natural language request    |
| `status`          | `'queued' \| 'in-progress' \| 'completed' \| 'failed'` | Yes      | Processing state                   |
| `chatMessageId`   | `string`                                               | Yes      | Source chat message                |
| `resultVersionId` | `string \| null`                                       | No       | Created version on success         |
| `errorMessage`    | `string \| null`                                       | No       | Error details on failure           |
| `queuedAt`        | `DateTime`                                             | Yes      | When the request entered the queue |
| `startedAt`       | `DateTime \| null`                                     | No       | When processing began              |
| `completedAt`     | `DateTime \| null`                                     | No       | When processing finished           |

**Validation Rules**:

- Only one request per tab may be `'in-progress'` at any time (FR-012a)
- Requests MUST be processed in FIFO order
- Failed requests MUST NOT block subsequent requests

---

### 12. ConsoleEntry

A debug console log entry capturing raw API request/response data.

| Field       | Type                                  | Required | Description                                |
| ----------- | ------------------------------------- | -------- | ------------------------------------------ |
| `id`        | `string`                              | Yes      | Unique identifier                          |
| `tabId`     | `string`                              | Yes      | Source tab                                 |
| `timestamp` | `DateTime`                            | Yes      | When the request was made                  |
| `request`   | `ConsoleRequest`                      | Yes      | Outgoing request details                   |
| `response`  | `ConsoleResponse \| null`             | No       | Incoming response (null if pending/failed) |
| `elapsedMs` | `number \| null`                      | No       | Total round-trip time                      |
| `status`    | `'pending' \| 'completed' \| 'error'` | Yes      | Entry state                                |

**Sub-types**:

```typescript
interface ConsoleRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: string;
}

interface ConsoleResponse {
  statusCode: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  bodySize: number;
}
```

---

## Cross-Entity Relationships Summary

| Relationship                          | Type    | Description                                          |
| ------------------------------------- | ------- | ---------------------------------------------------- |
| Application → Tab                     | 1:\*    | Application contains multiple tabs                   |
| Tab → APISpec                         | 1:0..1  | Each tab has at most one loaded spec                 |
| Tab → GeneratedInterface              | 1:0..1  | Each tab has at most one generated interface         |
| Tab → APIConnection                   | \*:0..1 | Multiple tabs can share one connection (by base URL) |
| Tab → ChatMessage                     | 1:\*    | Each tab has its own chat history                    |
| Tab → CustomizationRequest            | 1:\*    | Each tab has its own request queue                   |
| Tab → ConsoleEntry                    | 1:\*    | Each tab has its own console entries                 |
| GeneratedInterface → InterfaceVersion | 1:\*    | Interface has many versions (append-only)            |
| GeneratedInterface → APISpec          | 1:1     | Generated from exactly one spec                      |
| APIConnection → Tab                   | 1:\*    | Shared per base URL across tabs                      |
| InterfaceVersion → Plugin             | _:_     | Versions may depend on plugins                       |
