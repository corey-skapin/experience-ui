/**
 * Cross-process TypeScript type definitions shared between main and renderer.
 * All types are derived from the data model defined in specs/001-api-ui-generator/data-model.md.
 */

// ─── Spec format ───────────────────────────────────────────────────────────

/** Supported API specification formats. */
export type SpecFormat = 'openapi3' | 'swagger2' | 'graphql'

// ─── APISpec entity ────────────────────────────────────────────────────────

/** How the API spec was provided by the user. */
export type SpecSource =
  | { type: 'file'; fileName: string; filePath: string }
  | { type: 'url'; url: string }
  | { type: 'text' }

/** Extracted top-level metadata from a parsed spec. */
export interface SpecMetadata {
  title: string
  version: string
  description?: string
  baseUrl?: string
}

/** Validation issue found during spec parsing. */
export interface ValidationError {
  /** JSON pointer to the error location (e.g. "#/paths/~1users/get"). */
  path: string
  message: string
  severity: 'error' | 'warning'
}

/** A parsed and validated API specification provided by the user. */
export interface APISpec {
  id: string
  format: SpecFormat
  source: SpecSource
  rawContent: string
  normalizedSpec: NormalizedSpec
  validationStatus: 'valid' | 'invalid' | 'warnings'
  validationErrors?: ValidationError[]
  metadata: SpecMetadata
  parsedAt: number
}

// ─── NormalizedSpec ────────────────────────────────────────────────────────

/** A single data schema / type used within a spec. */
export interface NormalizedModel {
  name: string
  type: 'object' | 'array' | 'string' | 'number' | 'integer' | 'boolean' | 'null' | 'enum' | 'union'
  description?: string
  properties?: Record<string, NormalizedModel>
  /** Item type for array models. */
  items?: NormalizedModel
  required?: string[]
  /** Enum values for enum models. */
  enumValues?: string[]
  /** Member types for union/oneOf models. */
  unionOf?: NormalizedModel[]
  /** String format hint, e.g. "date-time", "email", "uri". */
  format?: string
  default?: unknown
  example?: unknown
}

/** A single REST endpoint parameter. */
export interface NormalizedParameter {
  name: string
  in: 'path' | 'query' | 'header' | 'cookie'
  type: string
  required: boolean
  description?: string
  schema?: NormalizedModel
}

/** A response definition for a specific HTTP status code. */
export interface NormalizedResponseModel {
  statusCode: string
  description: string
  schema?: NormalizedModel
}

/** A single REST API endpoint (one path + one HTTP method). */
export interface NormalizedEndpoint {
  path: string
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS'
  operationId?: string
  summary?: string
  description?: string
  tag?: string
  parameters: NormalizedParameter[]
  requestBody?: NormalizedModel
  responses: Record<string, NormalizedResponseModel>
  securityRequirements?: string[]
  deprecated?: boolean
}

/** A single GraphQL operation (query, mutation, or subscription). */
export interface NormalizedOperation {
  name: string
  type: 'query' | 'mutation' | 'subscription'
  description?: string
  args: NormalizedParameter[]
  returnType: NormalizedModel
  deprecated?: boolean
}

/** OAuth 2.0 flow configuration. */
export interface OAuthFlows {
  authorizationCode?: { authorizationUrl: string; tokenUrl: string; scopes: Record<string, string> }
  clientCredentials?: { tokenUrl: string; scopes: Record<string, string> }
  implicit?: { authorizationUrl: string; scopes: Record<string, string> }
}

/** An authentication / security scheme defined in the spec. */
export interface SecurityScheme {
  name: string
  type: 'apiKey' | 'oauth2' | 'http'
  in?: 'header' | 'query' | 'cookie'
  /** HTTP authentication scheme name, e.g. "bearer". */
  scheme?: string
  flows?: OAuthFlows
  description?: string
}

/** Unified internal representation of any parsed API specification. */
export interface NormalizedSpec {
  format: SpecFormat
  metadata: SpecMetadata
  /** REST API endpoints (OpenAPI / Swagger). */
  endpoints?: NormalizedEndpoint[]
  /** GraphQL queries. */
  queries?: NormalizedOperation[]
  /** GraphQL mutations. */
  mutations?: NormalizedOperation[]
  /** GraphQL subscriptions. */
  subscriptions?: NormalizedOperation[]
  models: NormalizedModel[]
  securitySchemes?: SecurityScheme[]
  tags?: string[]
}

// ─── Sandbox & GeneratedInterface types ───────────────────────────────────

/** Current state of the sandboxed iframe rendering a generated interface. */
export type SandboxState =
  | { status: 'idle' }
  | { status: 'loading'; progress: number }
  | { status: 'active'; iframeRef: string }
  | { status: 'error'; error: string; lastSafeVersionId: string }

/** An automatically created visual representation of an API spec. */
export interface GeneratedInterface {
  id: string
  tabId: string
  apiSpecId: string
  currentVersionId: string
  versions: InterfaceVersion[]
  sandboxState: SandboxState
  createdAt: number
}

// ─── Version History types ─────────────────────────────────────────────────

/** What caused a new interface version to be created. */
export type VersionChangeType = 'generation' | 'customization' | 'rollback'

/** An immutable snapshot of a generated interface at a point in time. */
export interface InterfaceVersion {
  id: string
  interfaceId: string
  versionNumber: number
  parentVersionId: string | null
  changeType: VersionChangeType
  description: string
  generationPrompt: string | null
  codePath: string
  codeHash: string
  isRevert: boolean
  revertedFromVersionId: string | null
  pluginDependencies?: string[]
  createdAt: number
}

// ─── Authentication & Connection types ─────────────────────────────────────

/** Authentication configuration for a live API (credential refs are opaque — never sent to renderer). */
export type AuthMethod =
  | { type: 'none' }
  | { type: 'apiKey'; headerName: string; keyRef: string }
  | { type: 'bearer'; tokenRef: string }
  | {
      type: 'oauth2'
      clientId: string
      authEndpoint: string
      tokenEndpoint: string
      scopes: string[]
      tokenRef: string
      refreshTokenRef: string
    }

/** Current connectivity state of an API connection. */
export type ConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'degraded'
  | 'expired'
  | 'unreachable'

/** Authentication and connectivity configuration for a live API base URL. */
export interface APIConnection {
  id: string
  baseUrl: string
  authMethod: AuthMethod
  status: ConnectionStatus
  lastVerifiedAt: number | null
  responseTimeMs: number | null
  tabIds: string[]
}

// ─── CLI types ─────────────────────────────────────────────────────────────

/** Current state of the embedded Copilot CLI subprocess. */
export type CLIStatusType = 'stopped' | 'starting' | 'running' | 'crashed' | 'restarting'

/** Runtime state of the CLI subprocess. */
export interface CLIState {
  status: CLIStatusType
  pid: number | null
  lastCrashAt: number | null
  restartCount: number
  pendingRequests: number
  errorMessage: string | null
}

// ─── Plugin types ──────────────────────────────────────────────────────────

/** Plugin category. */
export type PluginType = 'mcp-server' | 'transformer' | 'integration'

/** Plugin lifecycle state. */
export type PluginStatus = 'installed' | 'installing' | 'error' | 'uninstalling'

/** An installed extension providing additional capabilities. */
export interface Plugin {
  id: string
  name: string
  type: PluginType
  version: string
  status: PluginStatus
  configPath: string | null
  capabilities: string[]
  installPath: string
  installedAt: number
  dependentInterfaces?: string[]
  errorMessage: string | null
}

// ─── Tab types ─────────────────────────────────────────────────────────────

/** Lifecycle state of a tab workspace. */
export type TabStatus = 'empty' | 'spec-loaded' | 'generating' | 'interface-ready' | 'error'

/** A workspace container holding one generated interface and its associated state. */
export interface Tab {
  id: string
  title: string
  displayOrder: number
  isActive: boolean
  apiSpec: APISpec | null
  generatedInterface: GeneratedInterface | null
  connectionId: string | null
  chatHistory: ChatMessage[]
  customizationQueue: CustomizationRequest[]
  status: TabStatus
  createdAt: number
}

// ─── Chat types ────────────────────────────────────────────────────────────

/** Message sender role. */
export type MessageRole = 'user' | 'assistant' | 'system'

/** Message delivery status. */
export type MessageStatus = 'sent' | 'pending' | 'queued' | 'error'

/** An attached file or spec in a chat message. */
export interface MessageAttachment {
  type: 'spec-file' | 'image' | 'code-snippet'
  name: string
  content: string
  mimeType: string
}

/** A single chat message in a tab's conversation history. */
export interface ChatMessage {
  id: string
  tabId: string
  role: MessageRole
  content: string
  timestamp: number
  status: MessageStatus
  attachments?: MessageAttachment[]
  relatedVersionId: string | null
}

// ─── Customization types ───────────────────────────────────────────────────

/** Processing state of a customization request. */
export type CustomizationStatus = 'queued' | 'in-progress' | 'completed' | 'failed'

/** A queued request for natural language interface modification. */
export interface CustomizationRequest {
  id: string
  tabId: string
  prompt: string
  status: CustomizationStatus
  chatMessageId: string
  resultVersionId: string | null
  errorMessage: string | null
  queuedAt: number
  startedAt: number | null
  completedAt: number | null
}

// ─── Console types ─────────────────────────────────────────────────────────

/** Outgoing API request captured in the console. */
export interface ConsoleRequest {
  method: string
  url: string
  headers: Record<string, string>
  body?: string
}

/** Incoming API response captured in the console. */
export interface ConsoleResponse {
  statusCode: number
  statusText: string
  headers: Record<string, string>
  body: string
  bodySize: number
}

/** A debug console log entry capturing raw API request/response data. */
export interface ConsoleEntry {
  id: string
  tabId: string
  timestamp: number
  request: ConsoleRequest
  response: ConsoleResponse | null
  elapsedMs: number | null
  status: 'pending' | 'completed' | 'error'
}

// ─── Application state types ───────────────────────────────────────────────

/** Top-level singleton representing the entire application runtime state. */
export interface ApplicationState {
  tabs: Tab[]
  activeTabId: string | null
  cliState: CLIState
  plugins: Plugin[]
  theme: 'light' | 'dark'
  chatPanelWidth: number
  consoleVisible: boolean
}
