/**
 * Swagger 2.0 parser.
 * Converts Swagger 2.0 to OpenAPI 3.x using swagger2openapi,
 * then delegates to the OpenAPI parser for normalization.
 */
import type { ParseResult } from './openapi-parser'
import { parseOpenAPI } from './openapi-parser'

// ─── Conversion helper ────────────────────────────────────────────────────

interface Swagger2OpenAPIModule {
  convertObj: (...args: unknown[]) => void
}

function resolveConvertObj(mod: unknown): Swagger2OpenAPIModule['convertObj'] {
  if (mod && typeof mod === 'object' && 'default' in mod) {
    return (mod as { default: Swagger2OpenAPIModule }).default.convertObj
  }
  return (mod as Swagger2OpenAPIModule).convertObj
}

async function convertSwaggerToOpenAPI(swaggerDoc: Record<string, unknown>): Promise<string> {
  // Dynamic import to avoid typing issues with the CommonJS module
  const convert = await import('swagger2openapi')
  const convertObj = resolveConvertObj(convert)

  return new Promise((resolve, reject) => {
    convertObj(
      swaggerDoc,
      { patch: true, warnOnly: true },
      (err: Error | null, result: { openapi: unknown } | null) => {
        if (err || !result) {
          reject(err ?? new Error('No conversion result'))
          return
        }
        resolve(JSON.stringify(result.openapi))
      },
    )
  })
}

// ─── Parser ───────────────────────────────────────────────────────────────

export async function parseSwagger(content: string): Promise<ParseResult> {
  let swaggerDoc: Record<string, unknown>
  try {
    swaggerDoc = JSON.parse(content) as Record<string, unknown>
  } catch (err) {
    return {
      success: false,
      error: {
        message: `Failed to parse Swagger JSON: ${err instanceof Error ? err.message : String(err)}`,
      },
    }
  }

  let openApiJson: string
  try {
    openApiJson = await convertSwaggerToOpenAPI(swaggerDoc)
  } catch (err) {
    return {
      success: false,
      error: {
        message: `Swagger 2.0 conversion failed: ${err instanceof Error ? err.message : String(err)}`,
      },
    }
  }

  const result = await parseOpenAPI(openApiJson)

  // Override format to indicate original was swagger2
  if (result.success) {
    return {
      success: true,
      data: { ...result.data, format: 'swagger2' },
    }
  }

  return result
}
