// src/renderer/services/code-generator/index.ts
// T036 — Code generation orchestrator.
// Builds a prompt from a NormalizedSpec, invokes the CLI, validates, and compiles.

import type { NormalizedSpec } from '../../../shared/types';
import { validateCode } from '../code-validator';
import type { CodeViolation } from '../code-validator';

// ─── Public Types ─────────────────────────────────────────────────────────────

export type GenerationResult =
  | { success: true; compiledCode: string; rawCode: string }
  | { success: false; error: string; violations?: CodeViolation[] };

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Converts a NormalizedSpec into a structured CLI prompt.
 * Embedding the full JSON gives the model enough context to generate
 * a working React component with correct field names and types.
 */
function buildPrompt(spec: NormalizedSpec): string {
  return `Generate a React component UI for the following API spec: ${JSON.stringify(spec)}`;
}

// ─── Orchestration ────────────────────────────────────────────────────────────

/**
 * End-to-end pipeline: prompt → CLI → validate → compile.
 *
 * Steps:
 *  1. Send the spec prompt to the Copilot CLI via IPC.
 *  2. Validate the returned source against security patterns.
 *  3. Compile to an IIFE bundle via the app bridge.
 *
 * Returns a discriminated union so callers can narrow on `success`
 * without needing try/catch.
 */
export async function generateInterface(spec: NormalizedSpec): Promise<GenerationResult> {
  try {
    // ── Step 1: call CLI ───────────────────────────────────────────────────
    const cliResult = await window.experienceUI.cli.sendMessage({
      message: buildPrompt(spec),
    });

    if (!cliResult.success) {
      return { success: false, error: cliResult.error ?? 'CLI failed' };
    }

    const rawCode = cliResult.response;
    if (!rawCode) {
      return { success: false, error: 'No code generated' };
    }

    // ── Step 2: security validation ────────────────────────────────────────
    const { valid, violations } = validateCode(rawCode);
    if (!valid) {
      return {
        success: false,
        error: 'Generated code contains security violations',
        violations,
      };
    }

    // ── Step 3: compile to IIFE bundle ─────────────────────────────────────
    const compileResult = await window.experienceUI.app.compileCode({
      sourceCode: rawCode,
      format: 'iife',
      target: 'es2020',
      minify: false,
    });

    if (!compileResult.success) {
      return {
        success: false,
        error: compileResult.errors?.[0]?.message ?? 'Compilation failed',
      };
    }

    return {
      success: true,
      compiledCode: compileResult.compiledCode ?? '',
      rawCode,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}
