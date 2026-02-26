// src/renderer/services/code-validator/code-validator.ts
// T032 — Code validator / sanitizer for generated sandbox code.
// Scans generated code for disallowed patterns before sandbox injection.
// Per FR-034 security requirements.

import { DISALLOWED_CODE_PATTERNS } from '../../../shared/constants';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CodeViolation {
  /** String representation of the matched pattern (regex source). */
  pattern: string;
  /** Human-readable description of the violation. */
  description: string;
  /** Severity level: 'error' blocks injection; 'warning' indicates risk. */
  severity: 'error' | 'warning';
  /** Number of times this pattern was found in the code. */
  count: number;
}

export interface ValidationResult {
  /** False if any violations are found (errors OR warnings). */
  valid: boolean;
  /** Array of all detected violations. */
  violations: CodeViolation[];
  /** Total count of violations (equals violations.length). */
  violationCount: number;
}

// ─── Validator ────────────────────────────────────────────────────────────────

/**
 * Scan generated code for disallowed patterns.
 *
 * Returns a ValidationResult where:
 * - `valid` is false if ANY violations exist (errors or warnings)
 * - `violations` contains one entry per matched pattern
 * - `violationCount` equals violations.length
 */
export function validateCode(code: string): ValidationResult {
  const violations: CodeViolation[] = [];

  for (const entry of DISALLOWED_CODE_PATTERNS) {
    // Create a fresh RegExp with 'g' flag for match counting
    const regex = new RegExp(entry.pattern.source, 'g');
    const matches = code.match(regex);

    if (matches && matches.length > 0) {
      violations.push({
        pattern: entry.pattern.source,
        description: entry.description,
        severity: entry.severity,
        count: matches.length,
      });
    }
  }

  return {
    valid: violations.length === 0,
    violations,
    violationCount: violations.length,
  };
}
