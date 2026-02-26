// src/shared/types/index.ts
// Cross-process TypeScript type definitions (T007).
// All types shared between main process, renderer, and sandbox.
// Defined strictly per data-model.md.

// ─── Spec Source ─────────────────────────────────────────────────────────────

export type SpecSource =
  | { type: 'file'; fileName: string; filePath: string }
  | { type: 'url'; url: string }
  | { type: 'text' };

// ─── Spec Metadata ───────────────────────────────────────────────────────────

export interface SpecMetadata {
  title: string;
  version: string;
  description?: string;
  baseUrl?: string;
}

// ─── Validation Error ────────────────────────────────────────────────────────

export interface ValidationError {
  /** JSON pointer to the error location */
  path: string;
  /** Human-readable error description */
  message: string;
  severity: 'error' | 'warning';
}

// ─── Normalized Model ────────────────────────────────────────────────────────

export interface NormalizedModel {
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
  /** For arrays */
  items?: NormalizedModel;
  /** Required properties */
  required?: string[];
  /** For enums */
  enumValues?: string[];
  /** For union/oneOf types */
  unionOf?: NormalizedModel[];
  /** e.g. 'date-time', 'email', 'uri' */
  format?: string;
  default?: unknown;
  example?: unknown;
}

// ─── Normalized Parameter ────────────────────────────────────────────────────

export interface NormalizedParameter {
  name: string;
  in: 'path' | 'query' | 'header' | 'cookie';
  type: string;
  required: boolean;
  description?: string;
  schema?: NormalizedModel;
}

// ─── Normalized Response Model ───────────────────────────────────────────────

export interface NormalizedResponseModel {
  statusCode: string;
  description: string;
  schema?: NormalizedModel;
}

// ─── Normalized Endpoint ─────────────────────────────────────────────────────

export interface NormalizedEndpoint {
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

// ─── Normalized Operation (GraphQL) ──────────────────────────────────────────

export interface NormalizedOperation {
  name: string;
  type: 'query' | 'mutation' | 'subscription';
  description?: string;
  args: NormalizedParameter[];
  returnType: NormalizedModel;
  deprecated?: boolean;
}

// ─── OAuth Flows ─────────────────────────────────────────────────────────────

export interface OAuthFlow {
  authorizationUrl?: string;
  tokenUrl?: string;
  scopes: Record<string, string>;
}

export interface OAuthFlows {
  authorizationCode?: OAuthFlow;
  clientCredentials?: OAuthFlow;
  implicit?: OAuthFlow;
  password?: OAuthFlow;
}

// ─── Security Scheme ─────────────────────────────────────────────────────────

export interface SecurityScheme {
  name: string;
  type: 'apiKey' | 'oauth2' | 'http';
  in?: 'header' | 'query' | 'cookie';
  /** e.g. 'bearer' */
  scheme?: string;
  flows?: OAuthFlows;
  description?: string;
}

// ─── Normalized Spec ─────────────────────────────────────────────────────────

export interface NormalizedSpec {
  format: 'openapi3' | 'swagger2' | 'graphql';
  metadata: SpecMetadata;
  /** REST API endpoints (OpenAPI/Swagger) */
  endpoints?: NormalizedEndpoint[];
  /** GraphQL queries */
  queries?: NormalizedOperation[];
  /** GraphQL mutations */
  mutations?: NormalizedOperation[];
  /** GraphQL subscriptions */
  subscriptions?: NormalizedOperation[];
  models: NormalizedModel[];
  securitySchemes?: SecurityScheme[];
  tags?: string[];
}

// ─── API Spec ────────────────────────────────────────────────────────────────

export interface APISpec {
  id: string;
  format: 'openapi3' | 'swagger2' | 'graphql';
  source: SpecSource;
  rawContent: string;
  normalizedSpec: NormalizedSpec;
  validationStatus: 'valid' | 'invalid' | 'warnings';
  validationErrors?: ValidationError[];
  metadata: SpecMetadata;
  parsedAt: string; // ISO 8601 DateTime
}

// ─── Sandbox State ───────────────────────────────────────────────────────────

export type SandboxState =
  | { status: 'idle' }
  | { status: 'loading'; progress: number }
  | { status: 'active'; iframeRef: string }
  | { status: 'error'; error: string; lastSafeVersionId: string };

// ─── Interface Version ───────────────────────────────────────────────────────

export interface InterfaceVersion {
  id: string;
  interfaceId: string;
  versionNumber: number;
  parentVersionId: string | null;
  changeType: 'generation' | 'customization' | 'rollback';
  description: string;
  generationPrompt: string | null;
  codePath: string;
  codeHash: string;
  isRevert: boolean;
  revertedFromVersionId: string | null;
  pluginDependencies?: string[];
  createdAt: string; // ISO 8601 DateTime
}

// ─── Generated Interface ─────────────────────────────────────────────────────

export interface GeneratedInterface {
  id: string;
  tabId: string;
  apiSpecId: string;
  currentVersionId: string;
  versions: InterfaceVersion[];
  sandboxState: SandboxState;
  createdAt: string; // ISO 8601 DateTime
}

// ─── Auth Method ─────────────────────────────────────────────────────────────

export type AuthMethod =
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

// ─── Connection Status ───────────────────────────────────────────────────────

export type ConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'degraded'
  | 'expired'
  | 'unreachable';

// ─── API Connection ──────────────────────────────────────────────────────────

export interface APIConnection {
  id: string;
  /** Identity key: scheme + host + port */
  baseUrl: string;
  authMethod: AuthMethod;
  status: ConnectionStatus;
  lastVerifiedAt: string | null; // ISO 8601 DateTime
  responseTimeMs: number | null;
  tabIds: string[];
}

// ─── CLI State ───────────────────────────────────────────────────────────────

export interface CLIState {
  status: 'stopped' | 'starting' | 'running' | 'crashed' | 'restarting';
  pid: number | null;
  lastCrashAt: string | null; // ISO 8601 DateTime
  restartCount: number;
  pendingRequests: number;
  errorMessage: string | null;
}

// ─── Plugin ──────────────────────────────────────────────────────────────────

export interface Plugin {
  id: string;
  name: string;
  type: 'mcp-server' | 'transformer' | 'integration';
  version: string;
  status: 'installed' | 'installing' | 'error' | 'uninstalling';
  configPath: string | null;
  capabilities: string[];
  installPath: string;
  installedAt: string; // ISO 8601 DateTime
  dependentInterfaces?: string[];
  errorMessage: string | null;
}

// ─── Message Attachment ──────────────────────────────────────────────────────

export interface MessageAttachment {
  type: 'spec-file' | 'image' | 'code-snippet';
  name: string;
  content: string;
  mimeType: string;
}

// ─── Chat Message ────────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  tabId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string; // ISO 8601 DateTime
  status: 'sent' | 'pending' | 'queued' | 'error';
  attachments?: MessageAttachment[];
  relatedVersionId: string | null;
}

// ─── Customization Request ───────────────────────────────────────────────────

export interface CustomizationRequest {
  id: string;
  tabId: string;
  prompt: string;
  status: 'queued' | 'in-progress' | 'completed' | 'failed';
  chatMessageId: string;
  resultVersionId: string | null;
  errorMessage: string | null;
  queuedAt: string; // ISO 8601 DateTime
  startedAt: string | null; // ISO 8601 DateTime
  completedAt: string | null; // ISO 8601 DateTime
}

// ─── Console Request / Response ──────────────────────────────────────────────

export interface ConsoleRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: string;
}

export interface ConsoleResponse {
  statusCode: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  bodySize: number;
}

// ─── Console Entry ───────────────────────────────────────────────────────────

export interface ConsoleEntry {
  id: string;
  tabId: string;
  timestamp: string; // ISO 8601 DateTime
  request: ConsoleRequest;
  response: ConsoleResponse | null;
  elapsedMs: number | null;
  status: 'pending' | 'completed' | 'error';
}

// ─── Tab ─────────────────────────────────────────────────────────────────────

export interface Tab {
  id: string;
  title: string;
  displayOrder: number;
  isActive: boolean;
  apiSpec: APISpec | null;
  generatedInterface: GeneratedInterface | null;
  connectionId: string | null;
  chatHistory: ChatMessage[];
  customizationQueue: CustomizationRequest[];
  createdAt: string; // ISO 8601 DateTime
}

// ─── Application State ───────────────────────────────────────────────────────

export interface ApplicationState {
  tabs: Tab[];
  activeTabId: string | null;
  cliState: CLIState;
  plugins: Plugin[];
  theme: 'light' | 'dark';
  /** Chat panel width percentage (default: 30, range: 15–85) */
  chatPanelWidth: number;
  consoleVisible: boolean;
}
