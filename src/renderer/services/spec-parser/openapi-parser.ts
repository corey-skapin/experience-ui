// src/renderer/services/spec-parser/openapi-parser.ts
// T028 — OpenAPI 3.x parser using @apidevtools/swagger-parser.
// Validates, dereferences, and transforms an OpenAPI 3.x document into NormalizedSpec.

import SwaggerParser from '@apidevtools/swagger-parser';
import type { OpenAPIV3 } from 'openapi-types';

import type {
  NormalizedEndpoint,
  NormalizedModel,
  NormalizedParameter,
  NormalizedResponseModel,
  NormalizedSpec,
  SecurityScheme,
  ValidationError,
} from '../../../shared/types';

// ─── Result Type ──────────────────────────────────────────────────────────────

export interface OpenAPIParseResult {
  success: boolean;
  spec?: NormalizedSpec;
  validationErrors: ValidationError[];
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Parse, validate, and normalize an OpenAPI 3.x document.
 *
 * @param rawContent - Raw JSON (or YAML) string of the OpenAPI document.
 * @param format - 'openapi3' or 'swagger2' (swagger2 delegates here after conversion).
 */
export async function parseOpenAPI(
  rawContent: string,
  format: 'openapi3' | 'swagger2',
): Promise<OpenAPIParseResult> {
  // Step 1: parse JSON
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawContent);
  } catch (err) {
    return {
      success: false,
      validationErrors: [
        {
          path: '',
          message: err instanceof Error ? err.message : 'Invalid JSON',
          severity: 'error',
        },
      ],
    };
  }

  // Step 2: validate and dereference via swagger-parser
  let api: OpenAPIV3.Document;
  try {
    const result = await SwaggerParser.validate(
      parsed as Parameters<typeof SwaggerParser.validate>[0],
    );
    api = result as OpenAPIV3.Document;
  } catch (err) {
    return {
      success: false,
      validationErrors: [
        {
          path: '',
          message: err instanceof Error ? err.message : 'Validation failed',
          severity: 'error',
        },
      ],
    };
  }

  // Step 3: normalize
  const validationErrors: ValidationError[] = [];
  const spec = normalize(api, format, validationErrors);

  return { success: true, spec, validationErrors };
}

// ─── Normalization ────────────────────────────────────────────────────────────

function normalize(
  api: OpenAPIV3.Document,
  format: 'openapi3' | 'swagger2',
  warnings: ValidationError[],
): NormalizedSpec {
  const metadata = {
    title: api.info.title ?? '',
    version: api.info.version ?? '',
    description: api.info.description,
    baseUrl: api.servers?.[0]?.url ?? undefined,
  };

  const endpoints = extractEndpoints(api);
  const models = extractModels(api);
  const securitySchemes = extractSecuritySchemes(api);
  const tags = (api.tags ?? []).map((t) => t.name);

  if (endpoints.length === 0) {
    warnings.push({
      path: '/paths',
      message: 'No endpoints found — the spec has no paths defined',
      severity: 'warning',
    });
  }

  return { format, metadata, endpoints, models, securitySchemes, tags };
}

// ─── Endpoint Extraction ──────────────────────────────────────────────────────

const HTTP_METHODS = ['get', 'post', 'put', 'delete', 'patch', 'head', 'options'] as const;
type HttpMethod = (typeof HTTP_METHODS)[number];

function extractEndpoints(api: OpenAPIV3.Document): NormalizedEndpoint[] {
  const endpoints: NormalizedEndpoint[] = [];

  for (const [path, pathItem] of Object.entries(api.paths ?? {})) {
    if (!pathItem) continue;

    for (const method of HTTP_METHODS) {
      const operation = (pathItem as Record<string, unknown>)[method] as
        | OpenAPIV3.OperationObject
        | undefined;
      if (!operation) continue;

      endpoints.push(operationToEndpoint(path, method, operation, pathItem));
    }
  }

  return endpoints;
}

function operationToEndpoint(
  path: string,
  method: HttpMethod,
  op: OpenAPIV3.OperationObject,
  pathItem: OpenAPIV3.PathItemObject,
): NormalizedEndpoint {
  // Merge path-level params with operation-level params (operation takes precedence)
  const pathParams = (pathItem.parameters ?? []) as OpenAPIV3.ParameterObject[];
  const opParams = (op.parameters ?? []) as OpenAPIV3.ParameterObject[];
  const allParams = [...pathParams, ...opParams];

  const parameters: NormalizedParameter[] = allParams
    .filter((p): p is OpenAPIV3.ParameterObject => 'name' in p)
    .map(paramToNormalized);

  const responses: Record<string, NormalizedResponseModel> = {};
  for (const [code, resp] of Object.entries(op.responses ?? {})) {
    if (!resp || '$ref' in resp) continue;
    const r = resp as OpenAPIV3.ResponseObject;
    const schema = extractResponseSchema(r);
    responses[code] = {
      statusCode: code,
      description: r.description ?? '',
      schema,
    };
  }

  const requestBody = extractRequestBodySchema(
    op.requestBody as OpenAPIV3.RequestBodyObject | undefined,
  );
  const securityReqs = (op.security ?? []).flatMap((s) => Object.keys(s));

  return {
    path,
    method: method.toUpperCase() as NormalizedEndpoint['method'],
    operationId: op.operationId,
    summary: op.summary,
    description: op.description,
    tag: op.tags?.[0],
    parameters,
    requestBody,
    responses,
    securityRequirements: securityReqs.length > 0 ? securityReqs : undefined,
    deprecated: op.deprecated ?? false,
  };
}

function paramToNormalized(p: OpenAPIV3.ParameterObject): NormalizedParameter {
  const schema = p.schema as OpenAPIV3.SchemaObject | undefined;
  return {
    name: p.name,
    in: p.in as NormalizedParameter['in'],
    type: schema?.type ?? 'string',
    required: p.required ?? false,
    description: p.description,
    schema: schema ? schemaToModel(p.name, schema) : undefined,
  };
}

function extractResponseSchema(r: OpenAPIV3.ResponseObject): NormalizedModel | undefined {
  const jsonContent = r.content?.['application/json'];
  if (!jsonContent?.schema) return undefined;
  return schemaToModel('response', jsonContent.schema as OpenAPIV3.SchemaObject);
}

function extractRequestBodySchema(
  rb: OpenAPIV3.RequestBodyObject | undefined,
): NormalizedModel | undefined {
  if (!rb) return undefined;
  const jsonContent = rb.content?.['application/json'];
  if (!jsonContent?.schema) return undefined;
  return schemaToModel('body', jsonContent.schema as OpenAPIV3.SchemaObject);
}

// ─── Model Extraction ─────────────────────────────────────────────────────────

function extractModels(api: OpenAPIV3.Document): NormalizedModel[] {
  const schemas = api.components?.schemas ?? {};
  return Object.entries(schemas).map(([name, schema]) =>
    schemaToModel(name, schema as OpenAPIV3.SchemaObject),
  );
}

function schemaToModel(name: string, schema: OpenAPIV3.SchemaObject): NormalizedModel {
  const type = resolveModelType(schema);

  const model: NormalizedModel = { name, type };

  if (schema.description) model.description = schema.description;
  if (schema.format) model.format = schema.format;
  if ('default' in schema) model.default = schema.default;
  if ('example' in schema) model.example = schema.example;
  if (schema.required) model.required = schema.required;

  if (schema.enum) {
    model.enumValues = (schema.enum as unknown[]).map(String);
  }

  if (schema.properties) {
    model.properties = Object.fromEntries(
      Object.entries(schema.properties).map(([k, v]) => [
        k,
        schemaToModel(k, v as OpenAPIV3.SchemaObject),
      ]),
    );
  }

  if ('items' in schema && schema.items) {
    model.items = schemaToModel('item', schema.items as OpenAPIV3.SchemaObject);
  }

  if (schema.oneOf) {
    model.unionOf = (schema.oneOf as OpenAPIV3.SchemaObject[]).map((s, i) =>
      schemaToModel(`option${i}`, s),
    );
  }

  return model;
}

function resolveModelType(schema: OpenAPIV3.SchemaObject): NormalizedModel['type'] {
  if (schema.oneOf || schema.anyOf) return 'union';
  if (schema.enum) return 'enum';
  const t = schema.type as string | undefined;
  switch (t) {
    case 'object':
      return 'object';
    case 'array':
      return 'array';
    case 'string':
      return 'string';
    case 'number':
      return 'number';
    case 'integer':
      return 'integer';
    case 'boolean':
      return 'boolean';
    case 'null':
      return 'null';
    default:
      return 'object';
  }
}

// ─── Security Scheme Extraction ───────────────────────────────────────────────

function extractSecuritySchemes(api: OpenAPIV3.Document): SecurityScheme[] {
  const schemes = api.components?.securitySchemes ?? {};
  const result: SecurityScheme[] = [];

  for (const [name, scheme] of Object.entries(schemes)) {
    if (!scheme || '$ref' in scheme) continue;
    const s = scheme as OpenAPIV3.SecuritySchemeObject;

    if (s.type === 'apiKey') {
      result.push({
        name,
        type: 'apiKey',
        in: (s as OpenAPIV3.ApiKeySecurityScheme).in as SecurityScheme['in'],
        description: s.description,
      });
    } else if (s.type === 'http') {
      result.push({
        name,
        type: 'http',
        scheme: (s as OpenAPIV3.HttpSecurityScheme).scheme,
        description: s.description,
      });
    } else if (s.type === 'oauth2') {
      result.push({
        name,
        type: 'oauth2',
        description: s.description,
      });
    }
  }

  return result;
}
