/**
 * Unit tests for the code validator service.
 * Tests detection of disallowed patterns, valid code pass-through,
 * and violation counting.
 *
 * Tests are written FIRST (TDD) and MUST fail before implementation exists.
 */
import { describe, it, expect } from 'vitest'
import { validateCode } from './index'

// ─── Valid code pass-through ──────────────────────────────────────────────

describe('valid code pass-through', () => {
  it('passes clean React component code', () => {
    const code = `
      import React from 'react';
      function MyComponent() {
        return <div>Hello World</div>;
      }
      export default MyComponent;
    `
    const result = validateCode(code)
    expect(result.safe).toBe(true)
    expect(result.violations).toHaveLength(0)
  })

  it('passes code with fetch calls', () => {
    const code = `
      async function fetchData() {
        const res = await fetch('/api/data');
        return res.json();
      }
    `
    const result = validateCode(code)
    expect(result.safe).toBe(true)
  })

  it('passes code with console.log', () => {
    const result = validateCode('console.log("hello")')
    expect(result.safe).toBe(true)
  })
})

// ─── eval detection ───────────────────────────────────────────────────────

describe('eval detection', () => {
  it('detects eval()', () => {
    const code = 'eval("alert(1)")'
    const result = validateCode(code)
    expect(result.safe).toBe(false)
    expect(result.violations.some((v) => v.pattern === 'eval(')).toBe(true)
  })

  it('counts multiple eval occurrences', () => {
    const code = 'eval("x"); eval("y"); eval("z")'
    const result = validateCode(code)
    const evalViolation = result.violations.find((v) => v.pattern === 'eval(')
    expect(evalViolation?.count).toBe(3)
  })
})

// ─── Function() detection ─────────────────────────────────────────────────

describe('Function() detection', () => {
  it('detects new Function()', () => {
    const code = 'const fn = new Function("return 1")'
    const result = validateCode(code)
    expect(result.safe).toBe(false)
    expect(result.violations.some((v) => v.pattern === 'new Function(')).toBe(true)
  })
})

// ─── document.cookie detection ───────────────────────────────────────────

describe('document.cookie detection', () => {
  it('detects document.cookie read', () => {
    const code = 'const c = document.cookie'
    const result = validateCode(code)
    expect(result.safe).toBe(false)
    expect(result.violations.some((v) => v.pattern === 'document.cookie')).toBe(true)
  })

  it('detects document.cookie write', () => {
    const code = 'document.cookie = "test=value"'
    const result = validateCode(code)
    expect(result.safe).toBe(false)
  })
})

// ─── window.parent / window.top detection ────────────────────────────────

describe('window.parent / window.top detection', () => {
  it('detects window.parent access', () => {
    const result = validateCode('window.parent.location.href')
    expect(result.safe).toBe(false)
    expect(result.violations.some((v) => v.pattern === 'window.parent')).toBe(true)
  })

  it('detects window.top access', () => {
    const result = validateCode('window.top.document')
    expect(result.safe).toBe(false)
    expect(result.violations.some((v) => v.pattern === 'window.top')).toBe(true)
  })
})

// ─── require/import of Node modules ──────────────────────────────────────

describe('Node module import detection', () => {
  it('detects require()', () => {
    const result = validateCode('const fs = require("fs")')
    expect(result.safe).toBe(false)
    expect(result.violations.some((v) => v.pattern === 'require(')).toBe(true)
  })

  it('detects dynamic import()', () => {
    const result = validateCode('const mod = await import("module")')
    expect(result.safe).toBe(false)
    expect(result.violations.some((v) => v.pattern === 'import(')).toBe(true)
  })
})

// ─── postMessage to non-host detection ───────────────────────────────────

describe('postMessage to non-host detection', () => {
  it('detects window.parent.postMessage', () => {
    const result = validateCode('window.parent.postMessage({}, "*")')
    // window.parent is already caught; direct postMessage to * is also a violation
    expect(result.safe).toBe(false)
  })
})

// ─── Additional disallowed patterns ──────────────────────────────────────

describe('additional disallowed patterns', () => {
  it('detects window.opener', () => {
    const result = validateCode('window.opener.navigate("/")')
    expect(result.safe).toBe(false)
    expect(result.violations.some((v) => v.pattern === 'window.opener')).toBe(true)
  })

  it('detects process.env access', () => {
    const result = validateCode('process.env.SECRET_KEY')
    expect(result.safe).toBe(false)
    expect(result.violations.some((v) => v.pattern === 'process.env')).toBe(true)
  })
})

// ─── Violation structure ──────────────────────────────────────────────────

describe('violation structure', () => {
  it('returns violations with required fields', () => {
    const result = validateCode('eval("x")')
    expect(result.violations[0]).toMatchObject({
      pattern: expect.any(String),
      count: expect.any(Number),
      severity: expect.stringMatching(/error|warning/),
    })
  })

  it('returns total violation count', () => {
    const result = validateCode('eval("x"); document.cookie')
    expect(result.violationCount).toBeGreaterThanOrEqual(2)
  })
})
