/**
 * Code validator / sanitizer.
 * Scans generated code for disallowed patterns per FR-034.
 * Returns violations with severity and instance counts.
 */
import { DISALLOWED_CODE_PATTERNS } from '../../../shared/constants'

// ─── Types ────────────────────────────────────────────────────────────────

export interface CodeViolation {
  pattern: string
  count: number
  severity: 'error' | 'warning'
}

export interface ValidationResult {
  safe: boolean
  violations: CodeViolation[]
  violationCount: number
}

// ─── Pattern severity map ─────────────────────────────────────────────────

const SEVERITY_MAP: Record<string, 'error' | 'warning'> = {
  'eval(': 'error',
  'new Function(': 'error',
  'document.cookie': 'error',
  'window.parent': 'error',
  'window.top': 'error',
  'window.opener': 'error',
  'require(': 'error',
  'import(': 'error',
  __webpack_require__: 'warning',
  'process.env': 'warning',
  'global.': 'warning',
  'globalThis.': 'warning',
}

// ─── Validator ────────────────────────────────────────────────────────────

/**
 * Counts occurrences of a literal pattern in a string.
 */
function countOccurrences(text: string, pattern: string): number {
  let count = 0
  let index = 0
  while ((index = text.indexOf(pattern, index)) !== -1) {
    count++
    index += pattern.length
  }
  return count
}

/**
 * Validates generated code against the disallowed patterns list.
 * Returns a validation result with violations and safety status.
 */
export function validateCode(code: string): ValidationResult {
  const violations: CodeViolation[] = []

  for (const pattern of DISALLOWED_CODE_PATTERNS) {
    const count = countOccurrences(code, pattern)
    if (count > 0) {
      violations.push({
        pattern,
        count,
        severity: SEVERITY_MAP[pattern] ?? 'error',
      })
    }
  }

  const violationCount = violations.reduce((sum, v) => sum + v.count, 0)

  return {
    safe: violations.length === 0,
    violations,
    violationCount,
  }
}
