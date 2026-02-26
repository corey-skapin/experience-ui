/**
 * Spec parser facade.
 * Auto-detects format, delegates to the appropriate parser,
 * and returns NormalizedSpec or a descriptive error.
 *
 * Supported: OpenAPI 3.x, Swagger 2.0, GraphQL SDL, GraphQL introspection
 * Unsupported: RAML, WSDL (returns helpful error with supported alternatives)
 */
import { parseOpenAPI, type ParseResult } from './openapi-parser'
import { parseSwagger } from './swagger-parser'
import { parseGraphQL } from './graphql-parser'

export type SpecFileType = 'json' | 'yaml' | 'graphql' | 'xml' | 'yaml' | string

// ─── Format detection ────────────────────────────────────────────────────

type SpecFormatHint = 'openapi3' | 'swagger2' | 'graphql' | 'raml' | 'wsdl' | 'unknown'

function detectFormat(content: string, fileType: string): SpecFormatHint {
  const trimmed = content.trim()

  if (!trimmed) return 'unknown'

  // RAML detection
  if (trimmed.startsWith('#%RAML')) return 'raml'

  // WSDL detection (XML with wsdl namespace or definitions root)
  if (trimmed.startsWith('<') && (trimmed.includes('wsdl') || trimmed.includes('definitions'))) {
    return 'wsdl'
  }

  // GraphQL SDL
  if (fileType === 'graphql' || fileType === 'gql') return 'graphql'
  if (trimmed.includes('type Query') || trimmed.includes('type Mutation')) return 'graphql'

  // Try JSON parse
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>

      // GraphQL introspection
      if ('__schema' in parsed) return 'graphql'
      if (parsed.data && typeof parsed.data === 'object' && '__schema' in (parsed.data as object)) {
        return 'graphql'
      }

      // OpenAPI 3.x
      if (typeof parsed.openapi === 'string' && parsed.openapi.startsWith('3')) return 'openapi3'

      // Swagger 2.0
      if (typeof parsed.swagger === 'string' && parsed.swagger.startsWith('2')) return 'swagger2'
    } catch {
      // not valid JSON
    }
  }

  // YAML detection for OpenAPI/Swagger (check for key strings)
  if (fileType === 'yaml' || fileType === 'yml') {
    if (trimmed.includes('openapi:')) return 'openapi3'
    if (trimmed.includes('swagger:')) return 'swagger2'
  }

  return 'unknown'
}

// ─── Main parse function ──────────────────────────────────────────────────

export async function parseSpec(content: string, fileType: string): Promise<ParseResult> {
  const trimmed = content.trim()

  if (!trimmed) {
    return {
      success: false,
      error: { message: 'Spec content is empty. Please provide an API specification.' },
    }
  }

  const format = detectFormat(trimmed, fileType)

  if (format === 'raml') {
    return {
      success: false,
      error: {
        message:
          'RAML format is not supported. Please provide an OpenAPI 3.x, Swagger 2.0, or GraphQL specification.',
        supportedFormats: ['openapi3', 'swagger2', 'graphql'],
      },
    }
  }

  if (format === 'wsdl') {
    return {
      success: false,
      error: {
        message:
          'WSDL/SOAP format is not supported. Please provide an OpenAPI 3.x, Swagger 2.0, or GraphQL specification.',
        supportedFormats: ['openapi3', 'swagger2', 'graphql'],
      },
    }
  }

  if (format === 'graphql') {
    return parseGraphQL(trimmed)
  }

  if (format === 'openapi3') {
    return parseOpenAPI(trimmed)
  }

  if (format === 'swagger2') {
    return parseSwagger(trimmed)
  }

  // Unknown format — try each parser in sequence
  const openApiResult = await parseOpenAPI(trimmed)
  if (openApiResult.success) return openApiResult

  const swaggerResult = await parseSwagger(trimmed)
  if (swaggerResult.success) return swaggerResult

  const graphqlResult = await parseGraphQL(trimmed)
  if (graphqlResult.success) return graphqlResult

  return {
    success: false,
    error: {
      message:
        'Could not detect API specification format. Supported formats: OpenAPI 3.x (JSON/YAML), Swagger 2.0 (JSON), GraphQL SDL.',
      supportedFormats: ['openapi3', 'swagger2', 'graphql'],
    },
  }
}

export type { ParseResult, ParseSuccess, ParseFailure } from './openapi-parser'
