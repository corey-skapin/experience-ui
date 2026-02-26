import type { NormalizedSpec } from '../../../shared/types';

export interface GenerationResult {
  success: boolean;
  compiledCode?: string;
  rawCode?: string;
  errors?: Array<{ message: string }>;
  violations?: Array<{ pattern: string; severity: string; instances: number; description: string }>;
}

interface CLIGenerateResponse {
  result?: { code?: string };
  error?: { message: string };
}

interface ValidateResponse {
  valid: boolean;
  violations: Array<{ pattern: string; severity: string; instances: number; description: string }>;
}

interface CompileResponse {
  success: boolean;
  code?: string;
  errors?: Array<{ message: string }>;
}

export async function generateCode(spec: NormalizedSpec): Promise<GenerationResult> {
  const bridge = window.experienceUI;

  let cliResponse: CLIGenerateResponse;
  try {
    cliResponse = (await bridge.cli.sendMessage({
      method: 'generate',
      params: { spec, format: 'react', theme: 'light' },
    })) as CLIGenerateResponse;
  } catch (err: unknown) {
    return {
      success: false,
      errors: [{ message: err instanceof Error ? err.message : String(err) }],
    };
  }

  if (cliResponse.error) {
    return { success: false, errors: [{ message: cliResponse.error.message }] };
  }

  const rawCode = cliResponse.result?.code;
  if (!rawCode) {
    return { success: false, errors: [{ message: 'CLI returned no code' }] };
  }

  const validateResponse = (await bridge.app.validateCode({ code: rawCode })) as ValidateResponse;
  const errorViolations = validateResponse.violations.filter((v) => v.severity === 'error');
  if (errorViolations.length > 0) {
    return { success: false, rawCode, violations: validateResponse.violations };
  }

  const compileResponse = (await bridge.app.compileCode({ code: rawCode })) as CompileResponse;
  if (!compileResponse.success) {
    return {
      success: false,
      rawCode,
      errors: compileResponse.errors,
      violations: validateResponse.violations,
    };
  }

  return {
    success: true,
    compiledCode: compileResponse.code,
    rawCode,
    violations: validateResponse.violations,
  };
}
