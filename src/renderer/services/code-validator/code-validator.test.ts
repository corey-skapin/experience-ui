import { describe, it, expect } from 'vitest';
import { validateCode } from './code-validator';
import type { CodeViolation } from './code-validator';

describe('validateCode — disallowed patterns', () => {
  it('detects eval(...) and returns a violation with severity "error"', () => {
    const code = 'function run() { eval("alert(1)"); }';
    const violations = validateCode(code);
    expect(violations.length).toBeGreaterThan(0);
    const v = violations.find((x) => x.pattern === 'eval');
    expect(v).toBeDefined();
    expect(v?.severity).toBe('error');
  });

  it('detects new Function(...) and returns a violation with severity "error"', () => {
    const code = 'const fn = new Function("return 1");';
    const violations = validateCode(code);
    const v = violations.find((x) => x.pattern === 'Function constructor');
    expect(v).toBeDefined();
    expect(v?.severity).toBe('error');
  });

  it('detects document.cookie access', () => {
    const code = 'const c = document.cookie;';
    const violations = validateCode(code);
    const v = violations.find((x) => x.pattern === 'document.cookie');
    expect(v).toBeDefined();
    expect(v?.severity).toBe('error');
  });

  it('detects window.parent access', () => {
    const code = 'window.parent.postMessage("hi", "*");';
    const violations = validateCode(code);
    const v = violations.find((x) => x.pattern === 'window.parent');
    expect(v).toBeDefined();
    expect(v?.severity).toBe('error');
  });

  it('detects window.top access', () => {
    const code = 'const top = window.top;';
    const violations = validateCode(code);
    const v = violations.find((x) => x.pattern === 'window.top');
    expect(v).toBeDefined();
    expect(v?.severity).toBe('error');
  });

  it('detects postMessage to non-host origins (wildcard *)', () => {
    const code = 'window.postMessage({ type: "data" }, "*");';
    const violations = validateCode(code);
    const v = violations.find((x) => x.pattern.toLowerCase().includes('postmessage'));
    expect(v).toBeDefined();
  });

  it('detects require(...) — Node.js module import', () => {
    const code = 'const fs = require("fs");';
    const violations = validateCode(code);
    const v = violations.find((x) => x.pattern === 'Node.js require');
    expect(v).toBeDefined();
    expect(v?.severity).toBe('error');
  });

  it('detects dynamic import("node:...") — Node.js module import', () => {
    const code = 'const path = await import("node:path");';
    const violations = validateCode(code);
    const v = violations.find((x) => x.pattern === 'Node.js import');
    expect(v).toBeDefined();
    expect(v?.severity).toBe('error');
  });
});

describe('validateCode — valid code pass-through', () => {
  it('returns no violations for a simple React component', () => {
    const code = `
      import React from 'react';

      interface Props {
        name: string;
      }

      export function Greeting({ name }: Props) {
        return <div>Hello, {name}!</div>;
      }
    `;
    const violations = validateCode(code);
    const errors = violations.filter((v) => v.severity === 'error');
    expect(errors.length).toBe(0);
  });

  it('returns empty array for an empty string', () => {
    const violations = validateCode('');
    expect(Array.isArray(violations)).toBe(true);
    expect(violations.length).toBe(0);
  });
});

describe('validateCode — violation counting', () => {
  it('counts multiple occurrences of the same pattern in instances field', () => {
    const code = 'eval("a"); eval("b"); eval("c");';
    const violations = validateCode(code);
    const v = violations.find((x) => x.pattern === 'eval');
    expect(v).toBeDefined();
    expect(v?.instances).toBe(3);
  });

  it('reports multiple different violation types from a single code block', () => {
    const code = 'eval("x"); const c = document.cookie; const t = window.top;';
    const violations = validateCode(code);
    expect(violations.length).toBeGreaterThanOrEqual(3);
  });

  it('each violation has a description field', () => {
    const code = 'eval("x");';
    const violations = validateCode(code);
    violations.forEach((v: CodeViolation) => {
      expect(v).toHaveProperty('description');
      expect(typeof v.description).toBe('string');
    });
  });
});
