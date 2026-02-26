/**
 * Code generation orchestrator.
 * Pipeline: NormalizedSpec → CLI generate → validate → compile → return bundle.
 */
import type { NormalizedSpec } from '../../../shared/types'
import { validateCode } from '../code-validator'

// ─── Types ────────────────────────────────────────────────────────────────

export interface GenerationOptions {
  theme?: 'light' | 'dark'
  layout?: string
  includeAuth?: boolean
  pagination?: boolean
}

export interface GenerationProgress {
  stage: 'generating' | 'validating' | 'compiling'
  message: string
  streamedChunk?: string
}

export interface GenerationSuccess {
  success: true
  compiledCode: string
  description: string
  componentCount: number
}

export interface GenerationFailure {
  success: false
  error: string
  stage: 'generation' | 'validation' | 'compilation'
}

export type GenerationResult = GenerationSuccess | GenerationFailure

// ─── Bridge interface ─────────────────────────────────────────────────────

interface ExperienceUIBridge {
  cli: {
    sendMessage: (req: {
      message: string
      context?: Record<string, unknown>
    }) => Promise<{ success: boolean; response?: string; error?: string; requestId: string }>
  }
  app: {
    validateCode: (req: {
      code: string
    }) => Promise<{ safe: boolean; violations: unknown[]; violationCount: number }>
    compileCode: (req: {
      code: string
      format?: string
      target?: string
    }) => Promise<{ success: boolean; compiledCode?: string; error?: string }>
  }
}

// ─── Orchestrator ────────────────────────────────────────────────────────

export async function generateInterface(
  spec: NormalizedSpec,
  options: GenerationOptions = {},
  onProgress?: (progress: GenerationProgress) => void,
): Promise<GenerationResult> {
  const bridge = (window as unknown as { experienceUI?: ExperienceUIBridge }).experienceUI
  if (!bridge) {
    return { success: false, error: 'IPC bridge not available', stage: 'generation' }
  }

  // ── Stage 1: Generate via CLI ──────────────────────────────────────────

  onProgress?.({ stage: 'generating', message: 'Generating UI from API specification...' })

  let generatedCode: string
  let description = 'Generated interface'
  let componentCount = 0

  try {
    const cliRequest = {
      jsonrpc: '2.0',
      method: 'generate',
      params: {
        spec,
        format: 'react',
        theme: options.theme ?? 'light',
        options: {
          layout: options.layout ?? 'default',
          includeAuth: options.includeAuth ?? true,
          pagination: options.pagination ?? true,
        },
      },
    }

    const response = await bridge.cli.sendMessage({
      message: JSON.stringify(cliRequest),
      context: {},
    })

    if (!response.success || !response.response) {
      return {
        success: false,
        error: response.error ?? 'CLI generation failed with no response',
        stage: 'generation',
      }
    }

    let result: { code: string; description: string; componentCount: number }
    try {
      result = JSON.parse(response.response) as {
        code: string
        description: string
        componentCount: number
      }
    } catch {
      // Response may be plain code string
      result = { code: response.response, description: 'Generated interface', componentCount: 1 }
    }

    generatedCode = result.code
    description = result.description ?? description
    componentCount = result.componentCount ?? componentCount
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'CLI request failed',
      stage: 'generation',
    }
  }

  // ── Stage 2: Validate ──────────────────────────────────────────────────

  onProgress?.({ stage: 'validating', message: 'Validating generated code for security...' })

  // Client-side validation first (fast path)
  const clientValidation = validateCode(generatedCode)
  if (!clientValidation.safe) {
    const violations = clientValidation.violations
      .map((v) => `${v.pattern} (${v.count}x)`)
      .join(', ')
    return {
      success: false,
      error: `Generated code contains disallowed patterns: ${violations}`,
      stage: 'validation',
    }
  }

  // IPC validation (main process)
  try {
    const validationResult = await bridge.app.validateCode({ code: generatedCode })
    if (!validationResult.safe) {
      return {
        success: false,
        error: `Generated code failed security validation (${validationResult.violationCount} violations)`,
        stage: 'validation',
      }
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Validation IPC failed',
      stage: 'validation',
    }
  }

  // ── Stage 3: Compile ───────────────────────────────────────────────────

  onProgress?.({ stage: 'compiling', message: 'Compiling interface bundle...' })

  try {
    const compileResult = await bridge.app.compileCode({
      code: generatedCode,
      format: 'iife',
      target: 'es2020',
    })

    if (!compileResult.success || !compileResult.compiledCode) {
      return {
        success: false,
        error: compileResult.error ?? 'Compilation failed',
        stage: 'compilation',
      }
    }

    return {
      success: true,
      compiledCode: compileResult.compiledCode,
      description,
      componentCount,
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Compilation IPC failed',
      stage: 'compilation',
    }
  }
}
