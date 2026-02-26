import SwaggerParserLib from '@apidevtools/swagger-parser';
import type {
  NormalizedSpec,
  NormalizedEndpoint,
  NormalizedModel,
  NormalizedParameter,
  NormalizedResponseModel,
  ValidationError,
  SecurityScheme,
  OAuthFlows,
} from '../../../shared/types';
import type { OpenAPI, OpenAPIV3 } from 'openapi-types';

const SwaggerParser =
  (SwaggerParserLib as unknown as { default?: typeof SwaggerParserLib }).default ??
  SwaggerParserLib;

function schemaToModel(
  schema: OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject,
  name = 'anonymous',
): NormalizedModel {
  if ('$ref' in schema) {
    const refName = String(schema.$ref).split('/').pop() ?? 'unknown';
    return { name: refName, type: 'object' };
  }
  const s = schema as Record<string, unknown>;
  const rawType = s['type'];
  const type = Array.isArray(rawType)
    ? String(rawType[0] ?? 'object')
    : String(rawType ?? 'object');

  if (type === 'array' && s['items']) {
    return {
      name,
      type: 'array',
      description: s['description'] as string | undefined,
      items: schemaToModel(s['items'] as OpenAPIV3.SchemaObject, `${name}Item`),
    };
  }

  if (Array.isArray(s['enum'])) {
    return {
      name,
      type: 'enum',
      enumValues: (s['enum'] as unknown[]).map(String),
      description: s['description'] as string | undefined,
    };
  }

  const rawProperties = s['properties'] as Record<string, OpenAPIV3.SchemaObject> | undefined;
  const properties: Record<string, NormalizedModel> | undefined = rawProperties
    ? Object.fromEntries(Object.entries(rawProperties).map(([k, v]) => [k, schemaToModel(v, k)]))
    : undefined;

  return {
    name,
    type: (type as NormalizedModel['type']) ?? 'object',
    description: s['description'] as string | undefined,
    properties,
    required: s['required'] as string[] | undefined,
    format: s['format'] as string | undefined,
    default: s['default'],
    example: s['example'],
  };
}

function parameterToNormalized(
  p: OpenAPIV3.ParameterObject | OpenAPIV3.ReferenceObject,
): NormalizedParameter {
  if ('$ref' in p) {
    return { name: 'unknown', in: 'query', type: 'string', required: false };
  }
  const schema = p.schema as OpenAPIV3.SchemaObject | undefined;
  const schemaType = Array.isArray(schema?.type)
    ? String(schema?.type[0])
    : String(schema?.type ?? 'string');
  return {
    name: p.name,
    in: p.in as NormalizedParameter['in'],
    type: schemaType,
    required: p.required ?? false,
    description: p.description,
    schema: schema ? schemaToModel(schema, p.name) : undefined,
  };
}

function extractSecuritySchemes(api: OpenAPIV3.Document): SecurityScheme[] {
  const schemes = api.components?.securitySchemes ?? {};
  return Object.entries(schemes).map(([name, scheme]) => {
    if ('$ref' in scheme) return { name, type: 'apiKey' as const };
    const s = scheme as OpenAPIV3.SecuritySchemeObject;
    const flows: OAuthFlows | undefined =
      s.type === 'oauth2' && s.flows
        ? {
            authorizationCode: s.flows.authorizationCode
              ? {
                  authorizationUrl: s.flows.authorizationCode.authorizationUrl,
                  tokenUrl: s.flows.authorizationCode.tokenUrl ?? '',
                  scopes: s.flows.authorizationCode.scopes,
                }
              : undefined,
            clientCredentials: s.flows.clientCredentials
              ? {
                  tokenUrl: s.flows.clientCredentials.tokenUrl,
                  scopes: s.flows.clientCredentials.scopes,
                }
              : undefined,
          }
        : undefined;
    return {
      name,
      type: (s.type as SecurityScheme['type']) ?? 'apiKey',
      in: s.type === 'apiKey' ? (s.in as SecurityScheme['in']) : undefined,
      scheme: s.type === 'http' ? s.scheme : undefined,
      flows,
      description: s.description,
    };
  });
}

function buildEndpoints(api: OpenAPIV3.Document): NormalizedEndpoint[] {
  const endpoints: NormalizedEndpoint[] = [];
  const paths = api.paths ?? {};

  for (const [path, pathItem] of Object.entries(paths)) {
    if (!pathItem) continue;
    const methods = ['get', 'post', 'put', 'delete', 'patch', 'head', 'options'] as const;
    for (const method of methods) {
      const op = pathItem[method] as OpenAPIV3.OperationObject | undefined;
      if (!op) continue;

      const parameters: NormalizedParameter[] = (
        (pathItem.parameters ?? []).concat(op.parameters ?? []) as (
          | OpenAPIV3.ParameterObject
          | OpenAPIV3.ReferenceObject
        )[]
      ).map(parameterToNormalized);

      const responses: Record<string, NormalizedResponseModel> = {};
      for (const [code, resp] of Object.entries(op.responses ?? {})) {
        if ('$ref' in resp) continue;
        const r = resp as OpenAPIV3.ResponseObject;
        const jsonContent = r.content?.['application/json'];
        responses[code] = {
          statusCode: code,
          description: r.description ?? '',
          schema: jsonContent?.schema
            ? schemaToModel(jsonContent.schema as OpenAPIV3.SchemaObject, code)
            : undefined,
        };
      }

      const requestBodySchema = (() => {
        const rb = op.requestBody as OpenAPIV3.RequestBodyObject | undefined;
        const schema = rb?.content?.['application/json']?.schema;
        return schema ? schemaToModel(schema as OpenAPIV3.SchemaObject, 'body') : undefined;
      })();

      endpoints.push({
        path,
        method: method.toUpperCase() as NormalizedEndpoint['method'],
        operationId: op.operationId,
        summary: op.summary,
        description: op.description,
        tag: (op.tags ?? [])[0],
        parameters,
        requestBody: requestBodySchema,
        responses,
        securityRequirements: (op.security ?? []).flatMap((s) => Object.keys(s)),
        deprecated: op.deprecated,
      });
    }
  }
  return endpoints;
}

function buildModels(api: OpenAPIV3.Document): NormalizedModel[] {
  const schemas = api.components?.schemas ?? {};
  return Object.entries(schemas).map(([name, schema]) =>
    schemaToModel(schema as OpenAPIV3.SchemaObject, name),
  );
}

export type ParseResult =
  | { success: true; spec: NormalizedSpec }
  | { success: false; errors: ValidationError[] };

export async function parseOpenAPI3(
  rawContent: string,
  originalFormat: 'openapi3' | 'swagger2' = 'openapi3',
): Promise<ParseResult> {
  let parsed: OpenAPI.Document;
  try {
    parsed = await SwaggerParser.validate(JSON.parse(rawContent) as OpenAPI.Document);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      errors: [{ path: '', message, severity: 'error' }],
    };
  }

  const api = parsed as OpenAPIV3.Document;
  const endpoints = buildEndpoints(api);

  if (endpoints.length === 0) {
    return {
      success: false,
      errors: [
        {
          path: 'paths',
          message: 'Spec has no endpoints / no operations defined',
          severity: 'error',
        },
      ],
    };
  }

  const spec: NormalizedSpec = {
    format: originalFormat,
    metadata: {
      title: api.info.title,
      version: api.info.version,
      description: api.info.description,
      baseUrl: (api.servers ?? [])[0]?.url,
    },
    endpoints,
    models: buildModels(api),
    securitySchemes: extractSecuritySchemes(api),
    tags: (api.tags ?? []).map((t) => t.name),
  };

  return { success: true, spec };
}
