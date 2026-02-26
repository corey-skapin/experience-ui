import swagger2openapi from 'swagger2openapi';
import type { ConvertOutputOptions, S2OError } from 'swagger2openapi';
import type { OpenAPIV2 } from 'openapi-types';
import type { ParseResult } from './openapi-parser';
import { parseOpenAPI3 } from './openapi-parser';
import type { ValidationError } from '../../../shared/types';

export async function parseSwagger2(rawContent: string): Promise<ParseResult> {
  let converted: ConvertOutputOptions;
  try {
    const parsed = JSON.parse(rawContent) as OpenAPIV2.Document;
    converted = await new Promise<ConvertOutputOptions>((resolve, reject) => {
      swagger2openapi.convertObj(
        parsed,
        { patch: true, warnOnly: true },
        (err: S2OError | undefined, result: ConvertOutputOptions) => {
          if (err) reject(err);
          else resolve(result);
        },
      );
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      errors: [{ path: '', message, severity: 'error' as ValidationError['severity'] }],
    };
  }

  const openapi3Json = JSON.stringify(converted.openapi);
  const result = await parseOpenAPI3(openapi3Json, 'swagger2');
  return result;
}
