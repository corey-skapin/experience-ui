export type SpecFormat = 'openapi3' | 'swagger2' | 'graphql';

export type SpecSource =
  | { type: 'file'; fileName: string; filePath: string }
  | { type: 'url'; url: string }
  | { type: 'text' };

export interface SpecMetadata {
  title: string;
  version: string;
  description?: string;
  baseUrl?: string;
}

export interface ValidationError {
  path: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface NormalizedParameter {
  name: string;
  in: 'path' | 'query' | 'header' | 'cookie';
  type: string;
  required: boolean;
  description?: string;
  schema?: NormalizedModel;
}

export interface NormalizedResponseModel {
  statusCode: string;
  description: string;
  schema?: NormalizedModel;
}

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
  items?: NormalizedModel;
  required?: string[];
  enumValues?: string[];
  unionOf?: NormalizedModel[];
  format?: string;
  default?: unknown;
  example?: unknown;
}

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

export interface OAuthFlows {
  authorizationCode?: {
    authorizationUrl: string;
    tokenUrl: string;
    scopes: Record<string, string>;
  };
  implicit?: {
    authorizationUrl: string;
    scopes: Record<string, string>;
  };
  clientCredentials?: {
    tokenUrl: string;
    scopes: Record<string, string>;
  };
  password?: {
    tokenUrl: string;
    scopes: Record<string, string>;
  };
}

export interface SecurityScheme {
  name: string;
  type: 'apiKey' | 'oauth2' | 'http';
  in?: 'header' | 'query' | 'cookie';
  scheme?: string;
  flows?: OAuthFlows;
  description?: string;
}

export interface NormalizedOperation {
  name: string;
  type: 'query' | 'mutation' | 'subscription';
  description?: string;
  args: NormalizedParameter[];
  returnType: NormalizedModel;
  deprecated?: boolean;
}

export interface NormalizedSpec {
  format: SpecFormat;
  metadata: SpecMetadata;
  endpoints?: NormalizedEndpoint[];
  queries?: NormalizedOperation[];
  mutations?: NormalizedOperation[];
  subscriptions?: NormalizedOperation[];
  models: NormalizedModel[];
  securitySchemes?: SecurityScheme[];
  tags?: string[];
}

export interface APISpec {
  id: string;
  format: SpecFormat;
  source: SpecSource;
  rawContent: string;
  normalizedSpec: NormalizedSpec;
  validationStatus: 'valid' | 'invalid' | 'warnings';
  validationErrors?: ValidationError[];
  metadata: SpecMetadata;
  parsedAt: string;
}
