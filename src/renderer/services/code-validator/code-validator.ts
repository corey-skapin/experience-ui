import { DISALLOWED_CODE_PATTERNS } from '../../../shared/constants';

export interface CodeViolation {
  pattern: string;
  severity: 'error' | 'warning';
  instances: number;
  description: string;
}

const POSTMESSAGE_WILDCARD_PATTERN = {
  pattern: 'postMessage wildcard origin',
  regex: /\.postMessage\s*\([^)]*['"]\*['"]/g,
  severity: 'error' as const,
  description: 'postMessage with wildcard origin (*) is not allowed; use a specific target origin',
};

export function validateCode(code: string): CodeViolation[] {
  if (!code) return [];

  const violations: CodeViolation[] = [];

  for (const entry of DISALLOWED_CODE_PATTERNS) {
    // Reset lastIndex for global regex before each use
    entry.regex.lastIndex = 0;
    const matches = code.match(entry.regex);
    if (matches && matches.length > 0) {
      violations.push({
        pattern: entry.pattern,
        severity: entry.severity,
        instances: matches.length,
        description: entry.description,
      });
    }
    entry.regex.lastIndex = 0;
  }

  POSTMESSAGE_WILDCARD_PATTERN.regex.lastIndex = 0;
  const postMessageMatches = code.match(POSTMESSAGE_WILDCARD_PATTERN.regex);
  if (postMessageMatches && postMessageMatches.length > 0) {
    violations.push({
      pattern: POSTMESSAGE_WILDCARD_PATTERN.pattern,
      severity: POSTMESSAGE_WILDCARD_PATTERN.severity,
      instances: postMessageMatches.length,
      description: POSTMESSAGE_WILDCARD_PATTERN.description,
    });
  }

  return violations;
}
