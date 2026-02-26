import type { NormalizedSpec, ValidationError } from '../../../shared/types';
import { parseOpenAPI3 } from './openapi-parser';
import { parseSwagger2 } from './swagger-parser';
import { parseGraphQL } from './graphql-parser';

export type SpecParseResult =
  | { success: true; spec: NormalizedSpec }
  | { success: false; errors: ValidationError[] };

export type DetectedFormat = 'openapi3' | 'swagger2' | 'graphql' | null;

export function detectFormat(raw: string): DetectedFormat {
  if (!raw || !raw.trim()) return null;

  // Try JSON first
  let parsed: Record<string, unknown> | null = null;
  try {
    const obj = JSON.parse(raw);
    if (typeof obj === 'object' && obj !== null) {
      parsed = obj as Record<string, unknown>;
    }
  } catch {
    // Not JSON — could be YAML or GraphQL SDL
  }

  if (parsed) {
    if (typeof parsed['openapi'] === 'string') return 'openapi3';
    if (typeof parsed['swagger'] === 'string') return 'swagger2';
  }

  // GraphQL SDL detection
  if (/\btype\s+Query\b/i.test(raw) || /__schema\b/.test(raw)) {
    return 'graphql';
  }

  return null;
}

function isRaml(raw: string): boolean {
  return raw.trimStart().startsWith('#%RAML');
}

function isWsdl(raw: string): boolean {
  const trimmed = raw.trimStart();
  if (!trimmed.startsWith('<?xml')) return false;
  // Look for WSDL definitions element with the standard namespace
  const wsdlNamespacePattern = /xmlns(?::[a-z]+)?="http:\/\/schemas\.xmlsoap\.org\/wsdl\/"/;
  return wsdlNamespacePattern.test(raw);
}

export async function parseSpec(raw: string): Promise<SpecParseResult> {
  if (isRaml(raw)) {
    return {
      success: false,
      errors: [
        {
          path: '',
          message:
            'Unsupported format: RAML is not supported. Please convert your spec to OpenAPI 3.x, Swagger 2.0, or GraphQL SDL.',
          severity: 'error',
        },
      ],
    };
  }

  if (isWsdl(raw)) {
    return {
      success: false,
      errors: [
        {
          path: '',
          message:
            'Unsupported format: WSDL/SOAP is not supported. Supported formats: OpenAPI 3.x, Swagger 2.0, GraphQL SDL.',
          severity: 'error',
        },
      ],
    };
  }

  const format = detectFormat(raw);

  if (format === 'openapi3') {
    return parseOpenAPI3(raw);
  }

  if (format === 'swagger2') {
    return parseSwagger2(raw);
  }

  if (format === 'graphql') {
    return parseGraphQL(raw);
  }

  return {
    success: false,
    errors: [
      {
        path: '',
        message:
          'Could not detect API spec format. Supported formats: OpenAPI 3.x (openapi field), Swagger 2.0 (swagger field), GraphQL SDL (type Query).',
        severity: 'error',
      },
    ],
  };
}
