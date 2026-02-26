/**
 * Cross-process TypeScript type definitions shared between main and renderer.
 * All types are derived from the data model defined in specs/001-api-ui-generator/data-model.md.
 */

// ─── API Specification types ───────────────────────────────────────────────

export type SpecFormat = 'openapi-3' | 'swagger-2' | 'graphql'

export interface SpecSource {
  type: 'file' | 'url' | 'paste'
  value: string
  filename?: string
}

export interface SpecMetadata {
  id: string
  title: string
  version: string
  format: SpecFormat
  source: SpecSource
  parsedAt: number
  endpointCount: number
}

export interface ValidationError {
  path: string
  message: string
  severity: 'error' | 'warning'
}

export interface NormalizedModel {
  name: string
  properties: Record<string, NormalizedProperty>
  required: string[]
  description?: string
}

export interface NormalizedProperty {
  type: string
  format?: string
  description?: string
  required?: boolean
  enum?: string[]
  items?: NormalizedProperty
}

export interface SecurityScheme {
  name: string
  type: 'apiKey' | 'http' | 'oauth2' | 'openIdConnect'
  description?: string
  in?: 'header' | 'query' | 'cookie'
}

export interface NormalizedOperation {
  operationId: string
  method: string
  path: string
  summary?: string
  description?: string
  parameters: NormalizedParameter[]
  requestBody?: NormalizedRequestBody
  responses: NormalizedResponse[]
  security?: string[]
  tags?: string[]
}

export interface NormalizedParameter {
  name: string
  in: 'path' | 'query' | 'header' | 'cookie'
  required: boolean
  type: string
  description?: string
}

export interface NormalizedRequestBody {
  required: boolean
  contentType: string
  schema: NormalizedProperty
  description?: string
}

export interface NormalizedResponse {
  statusCode: string
  description: string
  contentType?: string
  schema?: NormalizedProperty
}

export interface NormalizedEndpoint {
  path: string
  operations: NormalizedOperation[]
  tags?: string[]
}

export interface NormalizedSpec {
  id: string
  title: string
  version: string
  format: SpecFormat
  description?: string
  baseUrls: string[]
  endpoints: NormalizedEndpoint[]
  models: NormalizedModel[]
  securitySchemes: SecurityScheme[]
  // GraphQL-specific
  queries?: NormalizedOperation[]
  mutations?: NormalizedOperation[]
  subscriptions?: NormalizedOperation[]
  types?: NormalizedModel[]
  metadata: SpecMetadata
}

// ─── Sandbox & Generated Interface types ──────────────────────────────────

export type SandboxStatus = 'idle' | 'loading' | 'ready' | 'error' | 'reloading'

export interface SandboxState {
  status: SandboxStatus
  nonce: string | null
  error: string | null
  currentVersionId: string | null
}

export interface GeneratedInterface {
  id: string
  specId: string
  compiledCode: string
  cssCode: string
  currentVersionId: string
  generatedAt: number
  generationPrompt: string
}

// ─── Version History types ─────────────────────────────────────────────────

export type VersionChangeType = 'generation' | 'customization' | 'rollback' | 'import'

export interface InterfaceVersion {
  id: string
  interfaceId: string
  versionNumber: number
  parentVersionId: string | null
  isRevert: boolean
  revertedFromId: string | null
  createdAt: number
  description: string
  changeType: VersionChangeType
  codePath: string
  codeHash: string
  generationPrompt?: string
}

// ─── Authentication & Connection types ─────────────────────────────────────

export type AuthMethodType = 'api-key' | 'bearer' | 'oauth2'
export type ConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'degraded'
  | 'expired'
  | 'error'

export interface AuthMethod {
  type: AuthMethodType
  // API Key
  headerName?: string
  queryParamName?: string
  // OAuth 2.0
  clientId?: string
  authorizationUrl?: string
  tokenUrl?: string
  scopes?: string[]
}

export interface APIConnection {
  baseUrl: string
  authMethod: AuthMethod
  status: ConnectionStatus
  lastCheckedAt: number | null
  responseTimeMs: number | null
  error: string | null
}

// ─── CLI types ─────────────────────────────────────────────────────────────

export type CLIStatusType = 'stopped' | 'starting' | 'running' | 'crashed' | 'restarting'

export interface CLIState {
  status: CLIStatusType
  pid: number | null
  restartCount: number
  pendingRequests: number
  errorMessage: string | null
  lastStartedAt: number | null
}

// ─── Plugin types ──────────────────────────────────────────────────────────

export type PluginStatus = 'installed' | 'enabled' | 'disabled' | 'error' | 'installing'

export interface Plugin {
  id: string
  name: string
  version: string
  description: string
  author: string
  status: PluginStatus
  installedAt: number
  configSchema?: Record<string, unknown>
  config?: Record<string, unknown>
}

// ─── Tab & UI types ────────────────────────────────────────────────────────

export type TabStatus = 'empty' | 'spec-loaded' | 'generating' | 'interface-ready' | 'error'

export interface Tab {
  id: string
  title: string
  apiSpec: NormalizedSpec | null
  generatedInterface: GeneratedInterface | null
  chatHistory: ChatMessage[]
  customizationQueue: CustomizationRequest[]
  status: TabStatus
  connection: APIConnection | null
  createdAt: number
  updatedAt: number
}

// ─── Chat types ────────────────────────────────────────────────────────────

export type MessageRole = 'user' | 'assistant' | 'system'
export type MessageStatus = 'sent' | 'pending' | 'queued' | 'error'

export interface MessageAttachment {
  type: 'spec' | 'file'
  name: string
  size: number
  mimeType: string
  content?: string
}

export interface ChatMessage {
  id: string
  role: MessageRole
  content: string
  status: MessageStatus
  timestamp: number
  attachments?: MessageAttachment[]
  isStreaming?: boolean
}

// ─── Customization types ───────────────────────────────────────────────────

export type CustomizationStatus = 'queued' | 'in-progress' | 'completed' | 'failed'

export interface CustomizationRequest {
  id: string
  tabId: string
  prompt: string
  status: CustomizationStatus
  queuedAt: number
  startedAt: number | null
  completedAt: number | null
  error: string | null
  linkedVersionId: string | null
}

// ─── Console types ─────────────────────────────────────────────────────────

export type ConsoleEntryLevel = 'log' | 'warn' | 'error' | 'info' | 'debug'

export interface ConsoleEntry {
  id: string
  level: ConsoleEntryLevel
  message: string
  timestamp: number
  source: 'sandbox' | 'host' | 'cli' | 'proxy'
  data?: unknown
}

export interface ConsoleRequest {
  method: string
  url: string
  headers: Record<string, string>
  body?: string
}

export interface ConsoleResponse {
  statusCode: number
  statusText: string
  headers: Record<string, string>
  body: string
  elapsedMs: number
}

// ─── Application state types ───────────────────────────────────────────────

export interface ApplicationState {
  theme: 'light' | 'dark' | 'system'
  chatPanelWidthPercent: number
  consoleVisible: boolean
  activeTabId: string | null
  tabs: Tab[]
  cliState: CLIState
  plugins: Plugin[]
}
