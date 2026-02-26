// src/renderer/services/spec-parser/spec-parser.ts
// T031 — Spec parser facade with format auto-detection.
// Routes the raw content to the appropriate parser based on detected format.
// Supports: OpenAPI 3.x, Swagger 2.0, GraphQL SDL.
// Rejects: RAML, WSDL, and other unsupported formats.

import type { NormalizedSpec, ValidationError } from '../../../shared/types';
import { parseGraphQL } from './graphql-parser';
import { parseOpenAPI } from './openapi-parser';
import { parseSwagger2 } from './swagger-parser';

// ─── Types ────────────────────────────────────────────────────────────────────

/** The detected format of a raw API spec string. */
export type DetectedFormat = 'openapi3' | 'swagger2' | 'graphql' | 'unknown';

/** Unified result returned by parseSpec. */
export interface SpecParseResult {
  /** Whether the spec was parsed without fatal errors. */
  success: boolean;
  /** Normalized spec if parsing succeeded (or partially succeeded). */
  spec?: NormalizedSpec;
  /** Validation errors and warnings collected during parsing. */
  validationErrors: ValidationError[];
}

// ─── Format Detection ─────────────────────────────────────────────────────────

/**
 * Auto-detect the format of a raw API spec string.
 *
 * Detection rules (in order of precedence):
 * 1. JSON with top-level `"openapi": "3.*"` field → 'openapi3'
 * 2. JSON with top-level `"swagger": "2.*"` field → 'swagger2'
 * 3. Text containing `type Query` (case-sensitive) → 'graphql'
 * 4. JSON with `__schema` field (introspection result) → 'graphql'
 * 5. Anything else → 'unknown'
 */
export function detectFormat(raw: string): DetectedFormat {
  if (!raw.trim()) return 'unknown';

  // Try JSON-based detection
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;

    // OpenAPI 3.x
    if (typeof parsed['openapi'] === 'string' && parsed['openapi'].startsWith('3.')) {
      return 'openapi3';
    }
    // Swagger 2.0
    if (typeof parsed['swagger'] === 'string' && parsed['swagger'].startsWith('2.')) {
      return 'swagger2';
    }
    // GraphQL introspection result
    if (parsed['__schema'] !== undefined) {
      return 'graphql';
    }
  } catch {
    // Not JSON — fall through to text-based detection
  }

  // GraphQL SDL detection: look for "type Query" (possibly with leading whitespace)
  if (/(?:^|\n)\s*type\s+Query\s*\{/.test(raw)) {
    return 'graphql';
  }

  return 'unknown';
}

// ─── Parser Facade ────────────────────────────────────────────────────────────

/**
 * Parse and normalize an API spec.
 *
 * @param raw - Raw spec content (JSON, YAML, or GraphQL SDL).
 * @param format - Format hint (from detectFormat). Use 'unknown' to reject.
 */
export async function parseSpec(raw: string, format: DetectedFormat): Promise<SpecParseResult> {
  switch (format) {
    case 'openapi3': {
      const result = await parseOpenAPI(raw, 'openapi3');
      return {
        success: result.success,
        spec: result.spec,
        validationErrors: result.validationErrors,
      };
    }

    case 'swagger2': {
      const result = await parseSwagger2(raw);
      return {
        success: result.success,
        spec: result.spec,
        validationErrors: result.validationErrors,
      };
    }

    case 'graphql': {
      const result = parseGraphQL(raw);
      return {
        success: result.success,
        spec: result.spec,
        validationErrors: result.validationErrors,
      };
    }

    default: {
      return {
        success: false,
        validationErrors: [
          {
            path: '',
            message:
              'Unsupported format. Experience UI supports OpenAPI 3.x, Swagger 2.0, and GraphQL SDL. ' +
              'RAML and WSDL are not supported.',
            severity: 'error',
          },
        ],
      };
    }
  }
}
