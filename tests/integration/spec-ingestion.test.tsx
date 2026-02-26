import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseSpec } from '../../src/renderer/services/spec-parser/spec-parser';
import { validateCode } from '../../src/renderer/services/code-validator/code-validator';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const FIXTURES_DIR = join(__dirname, '../fixtures');

function loadFixture(name: string): string {
  return readFileSync(join(FIXTURES_DIR, name), 'utf-8');
}

// Mock window.experienceUI bridge
const mockSendMessage = vi.fn();
const mockValidateCode = vi.fn();
const mockCompileCode = vi.fn();

beforeEach(() => {
  vi.stubGlobal('window', {
    ...globalThis.window,
    experienceUI: {
      cli: {
        sendMessage: mockSendMessage,
        getStatus: vi.fn().mockResolvedValue({ status: 'running' }),
        restart: vi.fn(),
        onStatusChanged: vi.fn(() => () => {}),
        onStreamResponse: vi.fn(() => () => {}),
      },
      app: {
        validateCode: mockValidateCode,
        compileCode: mockCompileCode,
      },
    },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('Spec-to-interface pipeline integration', () => {
  describe('Parsing phase', () => {
    it('parses a valid OpenAPI 3.x spec successfully', async () => {
      const raw = loadFixture('openapi3-valid.json');
      const result = await parseSpec(raw);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.spec.format).toBe('openapi3');
        expect(result.spec.endpoints?.length).toBeGreaterThan(0);
        expect(result.spec.metadata.title).toBeTruthy();
      }
    });

    it('parses a valid Swagger 2.0 spec successfully', async () => {
      const raw = loadFixture('swagger2-valid.json');
      const result = await parseSpec(raw);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.spec.format).toBe('swagger2');
        expect(result.spec.endpoints?.length).toBeGreaterThan(0);
      }
    });

    it('parses a valid GraphQL schema successfully', async () => {
      const raw = loadFixture('graphql-valid.graphql');
      const result = await parseSpec(raw);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.spec.format).toBe('graphql');
        expect(result.spec.queries?.length).toBeGreaterThan(0);
      }
    });

    it('returns errors for an invalid spec', async () => {
      const raw = loadFixture('invalid-malformed.json');
      const result = await parseSpec(raw);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Code validation phase', () => {
    it('validates safe React component code with no violations', () => {
      const safeCode = `
        import React from 'react';
        export function UserList({ users }) {
          return <ul>{users.map(u => <li key={u.id}>{u.name}</li>)}</ul>;
        }
      `;
      const violations = validateCode(safeCode);
      const errors = violations.filter((v) => v.severity === 'error');
      expect(errors.length).toBe(0);
    });

    it('detects unsafe patterns in generated code', () => {
      const unsafeCode = `
        function init() {
          eval("console.log('hacked')");
          const x = document.cookie;
        }
      `;
      const violations = validateCode(unsafeCode);
      expect(violations.length).toBeGreaterThan(0);
      expect(violations.some((v) => v.severity === 'error')).toBe(true);
    });
  });

  describe('Full pipeline — success path', () => {
    it('completes parse → generate → validate → compile for OpenAPI spec', async () => {
      const raw = loadFixture('openapi3-valid.json');

      // Step 1: Parse
      const parseResult = await parseSpec(raw);
      expect(parseResult.success).toBe(true);
      if (!parseResult.success) return;

      // Step 2: Mock CLI generate
      const generatedCode = `
        import React from 'react';
        export function App() { return <div>Pet Store</div>; }
      `;
      mockSendMessage.mockResolvedValueOnce({ result: { code: generatedCode } });

      // Step 3: Mock validation
      mockValidateCode.mockResolvedValueOnce({ valid: true, violations: [] });

      // Step 4: Mock compile
      const compiledCode = `(function() { /* compiled iife */ })()`;
      mockCompileCode.mockResolvedValueOnce({ success: true, code: compiledCode });

      // Simulate the pipeline
      const cliResponse = (await window.experienceUI.cli.sendMessage({
        method: 'generate',
        params: { spec: parseResult.spec },
      })) as { result: { code: string } };
      expect(cliResponse.result.code).toBe(generatedCode);

      const validateResponse = (await window.experienceUI.app.validateCode({
        code: generatedCode,
      })) as { valid: boolean; violations: unknown[] };
      expect(validateResponse.valid).toBe(true);

      const compileResponse = (await window.experienceUI.app.compileCode({
        code: generatedCode,
      })) as { success: boolean; code: string };
      expect(compileResponse.success).toBe(true);
      expect(compileResponse.code).toBe(compiledCode);
    });
  });

  describe('Full pipeline — error path', () => {
    it('returns parse errors for invalid spec and does not call CLI', async () => {
      const raw = loadFixture('invalid-malformed.json');
      const result = await parseSpec(raw);
      expect(result.success).toBe(false);
      expect(mockSendMessage).not.toHaveBeenCalled();
    });

    it('returns validation errors when generated code contains disallowed patterns', () => {
      const code = 'eval("dangerous"); const c = document.cookie;';
      const violations = validateCode(code);
      expect(violations.some((v) => v.pattern === 'eval')).toBe(true);
      expect(violations.some((v) => v.pattern === 'document.cookie')).toBe(true);
    });
  });
});
