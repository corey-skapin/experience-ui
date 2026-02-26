/**
 * OpenAPI 3.x parser.
 * Uses @apidevtools/swagger-parser for validation and $ref dereferencing.
 * Transforms to NormalizedSpec.
 */
import SwaggerParser from '@apidevtools/swagger-parser'
import type { OpenAPI, OpenAPIV3 } from 'openapi-types'
import type {
  NormalizedSpec,
  NormalizedEndpoint,
  NormalizedModel,
  NormalizedParameter,
  NormalizedResponseModel,
  SecurityScheme,
  ValidationError,
} from '../../../shared/types'

// ─── Result type ──────────────────────────────────────────────────────────

export interface ParseSuccess {
  success: true
  data: NormalizedSpec
}

export interface ParseFailure {
  success: false
  error: {
    message: string
    validationErrors?: ValidationError[]
    supportedFormats?: string[]
  }
}

export type ParseResult = ParseSuccess | ParseFailure

// ─── Schema → NormalizedModel ────────────────────────────────────────────

function normalizeSchema(
  schema: OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject | undefined,
  name = 'unknown',
): NormalizedModel {
  if (!schema || '$ref' in schema) {
    return { name, type: 'object' }
  }

  const s = schema as OpenAPIV3.SchemaObject

  if (s.type === 'array') {
    return {
      name,
      type: 'array',
      description: s.description,
      items: s.items ? normalizeSchema(s.items as OpenAPIV3.SchemaObject, 'item') : undefined,
    }
  }

  if (s.enum) {
    return {
      name,
      type: 'enum',
      description: s.description,
      enumValues: s.enum.map(String),
    }
  }

  if (s.oneOf || s.anyOf) {
    const members = (s.oneOf ?? s.anyOf ?? []) as OpenAPIV3.SchemaObject[]
    return {
      name,
      type: 'union',
      description: s.description,
      unionOf: members.map((m, i) => normalizeSchema(m, `${name}_${i}`)),
    }
  }

  const baseType = (s.type as NormalizedModel['type']) ?? 'object'

  return {
    name,
    type: baseType,
    description: s.description,
    format: s.format,
    properties: s.properties
      ? Object.fromEntries(
          Object.entries(s.properties).map(([k, v]) => [
            k,
            normalizeSchema(v as OpenAPIV3.SchemaObject, k),
          ]),
        )
      : undefined,
    required: s.required,
    default: s.default,
    example: s.example,
  }
}

// ─── Security schemes ─────────────────────────────────────────────────────

function normalizeSecuritySchemes(
  schemes: Record<string, OpenAPIV3.SecuritySchemeObject | OpenAPIV3.ReferenceObject> | undefined,
): SecurityScheme[] {
  if (!schemes) return []

  return Object.entries(schemes)
    .filter(([, v]) => !('$ref' in v))
    .map(([name, scheme]) => {
      const s = scheme as OpenAPIV3.SecuritySchemeObject
      if (s.type === 'apiKey') {
        return { name, type: 'apiKey' as const, in: s.in as 'header' | 'query', paramName: s.name }
      }
      if (s.type === 'http') {
        return { name, type: 'http' as const, scheme: s.scheme }
      }
      if (s.type === 'oauth2') {
        return { name, type: 'oauth2' as const }
      }
      return { name, type: 'http' as const }
    })
}

// ─── Endpoints ────────────────────────────────────────────────────────────

const HTTP_METHODS = ['get', 'post', 'put', 'delete', 'patch', 'head', 'options'] as const

function normalizeEndpoints(paths: OpenAPIV3.PathsObject): NormalizedEndpoint[] {
  const endpoints: NormalizedEndpoint[] = []

  for (const [path, pathItem] of Object.entries(paths)) {
    if (!pathItem) continue
    const item = pathItem as OpenAPIV3.PathItemObject

    for (const method of HTTP_METHODS) {
      const operation = item[method] as OpenAPIV3.OperationObject | undefined
      if (!operation) continue

      const parameters: NormalizedParameter[] = (
        (operation.parameters ?? []) as OpenAPIV3.ParameterObject[]
      )
        .filter((p) => !('$ref' in p))
        .map((p) => ({
          name: p.name,
          in: p.in as NormalizedParameter['in'],
          type: (p.schema as OpenAPIV3.SchemaObject | undefined)?.type ?? 'string',
          required: p.required ?? false,
          description: p.description,
          schema: p.schema
            ? normalizeSchema(p.schema as OpenAPIV3.SchemaObject, p.name)
            : undefined,
        }))

      const responses: Record<string, NormalizedResponseModel> = {}
      for (const [code, resp] of Object.entries(operation.responses ?? {})) {
        if ('$ref' in resp) continue
        const r = resp as OpenAPIV3.ResponseObject
        const mediaType = r.content?.['application/json'] as OpenAPIV3.MediaTypeObject | undefined
        responses[code] = {
          statusCode: code,
          description: r.description,
          schema: mediaType?.schema
            ? normalizeSchema(mediaType.schema as OpenAPIV3.SchemaObject, `Response${code}`)
            : undefined,
        }
      }

      const reqBody = operation.requestBody as OpenAPIV3.RequestBodyObject | undefined
      const requestBody = reqBody?.content?.['application/json']?.schema
        ? normalizeSchema(
            reqBody.content['application/json'].schema as OpenAPIV3.SchemaObject,
            'RequestBody',
          )
        : undefined

      endpoints.push({
        path,
        method: method.toUpperCase() as NormalizedEndpoint['method'],
        operationId: operation.operationId,
        summary: operation.summary,
        description: operation.description,
        tag: operation.tags?.[0],
        parameters,
        requestBody,
        responses,
        securityRequirements: (operation.security ?? []).flatMap(Object.keys),
        deprecated: operation.deprecated,
      })
    }
  }

  return endpoints
}

// ─── Models from components ───────────────────────────────────────────────

function normalizeComponents(
  components: OpenAPIV3.ComponentsObject | undefined,
): NormalizedModel[] {
  if (!components?.schemas) return []
  return Object.entries(components.schemas)
    .filter(([, v]) => !('$ref' in v))
    .map(([name, schema]) => normalizeSchema(schema as OpenAPIV3.SchemaObject, name))
}

// ─── Parser ───────────────────────────────────────────────────────────────

export async function parseOpenAPI(content: string): Promise<ParseResult> {
  let docObject: Record<string, unknown>
  try {
    docObject = JSON.parse(content) as Record<string, unknown>
  } catch (err) {
    return {
      success: false,
      error: {
        message: `Failed to parse JSON: ${err instanceof Error ? err.message : String(err)}`,
        validationErrors: [{ path: '#', message: 'Invalid JSON', severity: 'error' }],
      },
    }
  }

  let parsed: OpenAPI.Document
  try {
    parsed = await SwaggerParser.validate(docObject as OpenAPI.Document)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return {
      success: false,
      error: {
        message,
        validationErrors: [{ path: '#', message, severity: 'error' }],
      },
    }
  }

  const doc = parsed as OpenAPIV3.Document

  const endpoints = normalizeEndpoints(doc.paths ?? {})
  const models = normalizeComponents(doc.components)
  const securitySchemes = normalizeSecuritySchemes(
    doc.components?.securitySchemes as
      | Record<string, OpenAPIV3.SecuritySchemeObject | OpenAPIV3.ReferenceObject>
      | undefined,
  )

  const server = (doc.servers ?? [])[0]

  const normalized: NormalizedSpec = {
    format: 'openapi3',
    metadata: {
      title: doc.info.title,
      version: doc.info.version,
      description: doc.info.description,
      baseUrl: server?.url,
    },
    endpoints,
    models,
    securitySchemes,
    tags: [...new Set(endpoints.map((e) => e.tag).filter((t): t is string => !!t))],
  }

  return { success: true, data: normalized }
}
