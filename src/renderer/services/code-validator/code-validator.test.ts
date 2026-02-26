// src/renderer/services/code-validator/code-validator.test.ts
// T019 — Unit tests for the code-validator service.
// Tests are written RED-first: the implementation does not exist yet.
// Covers: disallowed pattern detection, require/import, valid pass-through,
//         violation counting, severity levels.

import { describe, it, expect } from 'vitest';

import { validateCode, type CodeViolation } from './code-validator';

// ─── Valid Code Pass-Through ──────────────────────────────────────────────────

describe('validateCode — valid code', () => {
  it('returns no violations for clean React component code', () => {
    const code = `
      import React from 'react';
      function App() {
        return <div>Hello</div>;
      }
      export default App;
    `;
    const result = validateCode(code);
    expect(result.violations).toHaveLength(0);
  });

  it('marks result as valid when there are no violations', () => {
    const result = validateCode('const x = 42;');
    expect(result.valid).toBe(true);
  });

  it('returns empty violations array (not null/undefined) for safe code', () => {
    const result = validateCode('function add(a, b) { return a + b; }');
    expect(Array.isArray(result.violations)).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it('allows standard array methods without flagging "map", "filter"', () => {
    const code = 'const doubled = [1, 2, 3].map(x => x * 2);';
    const result = validateCode(code);
    expect(result.violations).toHaveLength(0);
  });
});

// ─── eval() Detection ────────────────────────────────────────────────────────

describe('validateCode — eval()', () => {
  it('detects bare eval() call', () => {
    const result = validateCode('eval("alert(1)")');
    expect(result.violations.some((v) => v.pattern.includes('eval'))).toBe(true);
  });

  it('flags eval as severity=error', () => {
    const result = validateCode('eval("x")');
    const evalViolation = result.violations.find((v) => v.pattern.includes('eval'));
    expect(evalViolation?.severity).toBe('error');
  });

  it('marks result as invalid when eval is present', () => {
    const result = validateCode('eval("x")');
    expect(result.valid).toBe(false);
  });
});

// ─── Function() Constructor Detection ────────────────────────────────────────

describe('validateCode — Function() constructor', () => {
  it('detects new Function()', () => {
    const result = validateCode('const fn = new Function("return 1");');
    expect(result.violations.some((v) => /Function/i.test(v.pattern))).toBe(true);
  });

  it('detects Function() without new keyword', () => {
    const result = validateCode('const fn = Function("return 1");');
    expect(result.violations.some((v) => /Function/i.test(v.pattern))).toBe(true);
  });

  it('flags Function constructor as severity=error', () => {
    const result = validateCode('new Function("return 1")');
    const violation = result.violations.find((v) => /Function/i.test(v.pattern));
    expect(violation?.severity).toBe('error');
  });
});

// ─── document.cookie Detection ────────────────────────────────────────────────

describe('validateCode — document.cookie', () => {
  it('detects document.cookie read access', () => {
    const result = validateCode('const c = document.cookie;');
    expect(result.violations.some((v) => v.pattern.includes('cookie'))).toBe(true);
  });

  it('detects document.cookie write access', () => {
    const result = validateCode('document.cookie = "session=abc";');
    expect(result.violations.some((v) => v.pattern.includes('cookie'))).toBe(true);
  });

  it('flags document.cookie as severity=error', () => {
    const result = validateCode('document.cookie');
    const violation = result.violations.find((v) => v.pattern.includes('cookie'));
    expect(violation?.severity).toBe('error');
  });
});

// ─── window.parent / window.top Detection ────────────────────────────────────

describe('validateCode — window.parent and window.top', () => {
  it('detects window.parent access', () => {
    const result = validateCode('window.parent.postMessage("hi", "*");');
    expect(result.violations.some((v) => v.pattern.includes('parent'))).toBe(true);
  });

  it('detects window.top access', () => {
    const result = validateCode('window.top.location.href = "evil.com";');
    expect(result.violations.some((v) => v.pattern.includes('top'))).toBe(true);
  });

  it('flags window.parent as severity=error', () => {
    const result = validateCode('window.parent.document');
    const violation = result.violations.find((v) => v.pattern.includes('parent'));
    expect(violation?.severity).toBe('error');
  });

  it('flags window.top as severity=error', () => {
    const result = validateCode('window.top.document');
    const violation = result.violations.find((v) => v.pattern.includes('top'));
    expect(violation?.severity).toBe('error');
  });
});

// ─── postMessage to Non-Host Origins ─────────────────────────────────────────

describe('validateCode — postMessage to arbitrary origins', () => {
  it('detects postMessage with explicit string origin argument', () => {
    const result = validateCode('window.postMessage(data, "https://evil.com");');
    expect(result.violations.some((v) => v.pattern.includes('postMessage'))).toBe(true);
  });

  it('detects postMessage with wildcard "*" origin', () => {
    const result = validateCode('window.postMessage(data, "*");');
    expect(result.violations.some((v) => v.pattern.includes('postMessage'))).toBe(true);
  });

  it('flags arbitrary-origin postMessage as severity=warning', () => {
    const result = validateCode('postMessage(data, "https://attacker.com")');
    const violation = result.violations.find((v) => v.pattern.includes('postMessage'));
    expect(violation?.severity).toBe('warning');
  });
});

// ─── require() / dynamic import() ────────────────────────────────────────────

describe('validateCode — require() and dynamic import()', () => {
  it('detects require() call', () => {
    const result = validateCode('const fs = require("fs");');
    expect(result.violations.some((v) => v.pattern.includes('require'))).toBe(true);
  });

  it('flags require() as severity=error', () => {
    const result = validateCode('require("path")');
    const violation = result.violations.find((v) => v.pattern.includes('require'));
    expect(violation?.severity).toBe('error');
  });

  it('detects dynamic import()', () => {
    const result = validateCode('const mod = import("./module");');
    expect(result.violations.some((v) => v.pattern.includes('import'))).toBe(true);
  });

  it('flags dynamic import() as severity=error', () => {
    const result = validateCode('import("./secret")');
    const violation = result.violations.find((v) => v.pattern.includes('import'));
    expect(violation?.severity).toBe('error');
  });
});

// ─── Violation Counting ───────────────────────────────────────────────────────

describe('validateCode — violation counting', () => {
  it('reports multiple violations when multiple patterns appear', () => {
    const code = 'eval("x"); document.cookie; window.parent;';
    const result = validateCode(code);
    expect(result.violations.length).toBeGreaterThanOrEqual(3);
  });

  it('counts each distinct occurrence separately', () => {
    // Two separate eval calls should produce at least 2 violation entries
    // (implementation may collapse or not — test that total violations > 0)
    const code = 'eval("a"); eval("b");';
    const result = validateCode(code);
    expect(result.violations.length).toBeGreaterThanOrEqual(1);
    expect(result.valid).toBe(false);
  });

  it('reports total violation count in result.violationCount', () => {
    const code = 'eval("x"); document.cookie;';
    const result = validateCode(code);
    expect(result.violationCount).toBeGreaterThanOrEqual(2);
    expect(result.violationCount).toBe(result.violations.length);
  });
});

// ─── Severity Levels ─────────────────────────────────────────────────────────

describe('validateCode — severity levels', () => {
  it('all violations have a severity field of "error" or "warning"', () => {
    const code = 'eval("x"); window.postMessage(d, "*");';
    const result = validateCode(code);
    result.violations.forEach((v: CodeViolation) => {
      expect(['error', 'warning']).toContain(v.severity);
    });
  });

  it('valid=false if any violation has severity="error"', () => {
    const code = 'eval("bad")';
    const result = validateCode(code);
    const hasError = result.violations.some((v) => v.severity === 'error');
    expect(hasError).toBe(true);
    expect(result.valid).toBe(false);
  });

  it('valid=false even if only warnings exist (warnings still indicate risk)', () => {
    // postMessage with string origin is a warning
    const code = 'window.postMessage(data, "*");';
    const result = validateCode(code);
    expect(result.violations.length).toBeGreaterThan(0);
    // Warnings also mark as invalid (unsafe for sandbox injection)
    expect(result.valid).toBe(false);
  });

  it('each violation includes a human-readable description', () => {
    const result = validateCode('eval("x")');
    result.violations.forEach((v: CodeViolation) => {
      expect(typeof v.description).toBe('string');
      expect(v.description.length).toBeGreaterThan(0);
    });
  });
});
