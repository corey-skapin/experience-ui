// src/renderer/services/spec-parser/swagger-parser.ts
// T029 — Swagger 2.0 parser.
// Converts Swagger 2.0 to OpenAPI 3.x using swagger2openapi, then
// delegates normalization to the OpenAPI parser.

import { convertStr } from 'swagger2openapi';

import type { ValidationError } from '../../../shared/types';
import { parseOpenAPI, type OpenAPIParseResult } from './openapi-parser';

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Parse a Swagger 2.0 document by converting it to OpenAPI 3.x first.
 * The resulting NormalizedSpec will have `format: 'swagger2'`.
 *
 * @param rawContent - Raw JSON string of the Swagger 2.0 document.
 */
export async function parseSwagger2(rawContent: string): Promise<OpenAPIParseResult> {
  // Step 1: Convert Swagger 2.0 → OpenAPI 3.x
  let openapi3Json: string;
  try {
    const result = await convertStr(rawContent, {
      patch: true,
      warnOnly: true,
    });
    openapi3Json = JSON.stringify(result.openapi);
  } catch (err) {
    const errors: ValidationError[] = [
      {
        path: '',
        message: err instanceof Error ? err.message : 'Swagger 2.0 conversion failed',
        severity: 'error',
      },
    ];
    return { success: false, validationErrors: errors };
  }

  // Step 2: Delegate to OpenAPI parser with format='swagger2'
  const result = await parseOpenAPI(openapi3Json, 'swagger2');
  return result;
}
