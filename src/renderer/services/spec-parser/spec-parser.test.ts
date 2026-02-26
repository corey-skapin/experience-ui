// src/renderer/services/spec-parser/spec-parser.test.ts
// T018 — Unit tests for the API spec parser service.
// Tests are written RED-first: the implementation does not exist yet.
// Covers: format auto-detection, OpenAPI 3.x, Swagger 2.0→3.x conversion,
//         GraphQL parsing, validation errors, unsupported formats, empty specs.

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, it, expect, beforeEach } from 'vitest';

import { detectFormat, parseSpec, type SpecParseResult, type DetectedFormat } from './spec-parser';
import type { ValidationError } from '../../../shared/types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const FIXTURES_DIR = resolve(__dirname, '../../../../tests/fixtures');

function fixture(name: string): string {
  return readFileSync(resolve(FIXTURES_DIR, name), 'utf-8');
}

// ─── Format Auto-Detection ────────────────────────────────────────────────────

describe('detectFormat', () => {
  it('detects openapi3 when spec has top-level "openapi" field starting with "3."', () => {
    const format = detectFormat('{"openapi":"3.0.3","info":{"title":"T","version":"1"}}');
    expect(format).toBe('openapi3');
  });

  it('detects swagger2 when spec has top-level "swagger" field starting with "2."', () => {
    const format = detectFormat('{"swagger":"2.0","info":{"title":"T","version":"1"}}');
    expect(format).toBe('swagger2');
  });

  it('detects graphql when schema contains "type Query"', () => {
    const format = detectFormat('type Query {\n  hello: String\n}');
    expect(format).toBe('graphql');
  });

  it('detects graphql when schema contains "type Query" with leading whitespace', () => {
    const format = detectFormat('  type Query {\n  ping: Boolean\n}');
    expect(format).toBe('graphql');
  });

  it('detects openapi3 from real fixture', () => {
    const raw = fixture('openapi3-valid.json');
    expect(detectFormat(raw)).toBe('openapi3');
  });

  it('detects swagger2 from real fixture', () => {
    const raw = fixture('swagger2-valid.json');
    expect(detectFormat(raw)).toBe('swagger2');
  });

  it('detects graphql from real fixture', () => {
    const raw = fixture('graphql-valid.graphql');
    expect(detectFormat(raw)).toBe('graphql');
  });

  it('returns "unknown" for a RAML spec (starts with #%RAML)', () => {
    const format = detectFormat('#%RAML 1.0\ntitle: My API');
    expect(format).toBe('unknown');
  });

  it('returns "unknown" for a WSDL document (contains <definitions xmlns)', () => {
    const format = detectFormat(
      '<definitions xmlns="http://schemas.xmlsoap.org/wsdl/"></definitions>',
    );
    expect(format).toBe('unknown');
  });

  it('returns "unknown" for completely empty string', () => {
    const format = detectFormat('');
    expect(format).toBe('unknown');
  });
});

// ─── OpenAPI 3.x Parsing ─────────────────────────────────────────────────────

describe('parseSpec — OpenAPI 3.x', () => {
  let result: SpecParseResult;

  beforeEach(async () => {
    result = await parseSpec(fixture('openapi3-valid.json'), 'openapi3');
  });

  it('succeeds without fatal errors', () => {
    expect(result.success).toBe(true);
  });

  it('sets format to "openapi3" in normalized spec', () => {
    expect(result.spec?.format).toBe('openapi3');
  });

  it('extracts title from info object', () => {
    expect(result.spec?.metadata.title).toBe('Petstore API');
  });

  it('extracts version from info object', () => {
    expect(result.spec?.metadata.version).toBe('1.0.0');
  });

  it('populates at least one endpoint', () => {
    expect(result.spec?.endpoints?.length).toBeGreaterThan(0);
  });

  it('normalizes endpoint method to uppercase', () => {
    const methods = result.spec?.endpoints?.map((e) => e.method) ?? [];
    expect(methods.every((m) => m === m.toUpperCase())).toBe(true);
  });

  it('extracts base URL from first server entry', () => {
    expect(result.spec?.metadata.baseUrl).toBe('https://petstore.example.com/v1');
  });

  it('populates models array from components/schemas', () => {
    expect(result.spec?.models.length).toBeGreaterThan(0);
  });
});

// ─── Swagger 2.0 → 3.x Conversion ────────────────────────────────────────────

describe('parseSpec — Swagger 2.0', () => {
  let result: SpecParseResult;

  beforeEach(async () => {
    result = await parseSpec(fixture('swagger2-valid.json'), 'swagger2');
  });

  it('succeeds without fatal errors', () => {
    expect(result.success).toBe(true);
  });

  it('reports format as "swagger2" in the normalized output', () => {
    expect(result.spec?.format).toBe('swagger2');
  });

  it('extracts metadata title from Swagger info', () => {
    expect(result.spec?.metadata.title).toBe('Bookstore API');
  });

  it('constructs baseUrl from host + basePath + scheme', () => {
    expect(result.spec?.metadata.baseUrl).toBe('https://bookstore.example.com/api/v2');
  });

  it('converts Swagger paths into normalized endpoints', () => {
    expect(result.spec?.endpoints?.length).toBeGreaterThan(0);
  });

  it('converts inline Swagger parameter types to NormalizedParameter', () => {
    const allParams = result.spec?.endpoints?.flatMap((e) => e.parameters) ?? [];
    expect(allParams.length).toBeGreaterThan(0);
    allParams.forEach((p) => {
      expect(p).toHaveProperty('name');
      expect(p).toHaveProperty('in');
      expect(p).toHaveProperty('required');
    });
  });
});

// ─── GraphQL Schema Parsing ───────────────────────────────────────────────────

describe('parseSpec — GraphQL', () => {
  let result: SpecParseResult;

  beforeEach(async () => {
    result = await parseSpec(fixture('graphql-valid.graphql'), 'graphql');
  });

  it('succeeds without fatal errors', () => {
    expect(result.success).toBe(true);
  });

  it('sets format to "graphql"', () => {
    expect(result.spec?.format).toBe('graphql');
  });

  it('populates queries from type Query fields', () => {
    expect(result.spec?.queries?.length).toBeGreaterThan(0);
  });

  it('populates mutations from type Mutation fields', () => {
    expect(result.spec?.mutations?.length).toBeGreaterThan(0);
  });

  it('does not populate REST endpoints', () => {
    expect(result.spec?.endpoints).toBeUndefined();
  });

  it('extracts object types into models', () => {
    expect(result.spec?.models.length).toBeGreaterThan(0);
  });
});

// ─── Validation Error Reporting ───────────────────────────────────────────────

describe('parseSpec — validation errors', () => {
  it('returns success=false for malformed JSON', async () => {
    const raw = fixture('invalid-malformed.json');
    const result = await parseSpec(raw, 'openapi3');
    expect(result.success).toBe(false);
  });

  it('populates validationErrors array with at least one error', async () => {
    const raw = fixture('invalid-malformed.json');
    const result = await parseSpec(raw, 'openapi3');
    expect(result.validationErrors.length).toBeGreaterThan(0);
  });

  it('each validation error has path, message, and severity', async () => {
    const raw = fixture('invalid-malformed.json');
    const result = await parseSpec(raw, 'openapi3');
    result.validationErrors.forEach((err: ValidationError) => {
      expect(err).toHaveProperty('path');
      expect(err).toHaveProperty('message');
      expect(['error', 'warning']).toContain(err.severity);
    });
  });
});

// ─── Unsupported Format Rejection ─────────────────────────────────────────────

describe('parseSpec — unsupported formats', () => {
  it('rejects RAML content with success=false', async () => {
    const raml = '#%RAML 1.0\ntitle: My API\nversion: v1\nbaseUri: https://api.example.com';
    const result = await parseSpec(raml, 'unknown' as DetectedFormat);
    expect(result.success).toBe(false);
  });

  it('returns a validation error describing the unsupported format', async () => {
    const raml = '#%RAML 1.0\ntitle: My API';
    const result = await parseSpec(raml, 'unknown' as DetectedFormat);
    const hasFormatError = result.validationErrors.some(
      (e) =>
        e.message.toLowerCase().includes('unsupported') ||
        e.message.toLowerCase().includes('format'),
    );
    expect(hasFormatError).toBe(true);
  });

  it('rejects WSDL content with success=false', async () => {
    const wsdl =
      '<definitions xmlns="http://schemas.xmlsoap.org/wsdl/"><portType name="Foo"/></definitions>';
    const result = await parseSpec(wsdl, 'unknown' as DetectedFormat);
    expect(result.success).toBe(false);
  });
});

// ─── Empty Spec Detection ─────────────────────────────────────────────────────

describe('parseSpec — empty spec', () => {
  it('parses empty-spec.json without throwing', async () => {
    const raw = fixture('empty-spec.json');
    await expect(parseSpec(raw, 'openapi3')).resolves.toBeDefined();
  });

  it('reports a warning when there are no endpoints', async () => {
    const raw = fixture('empty-spec.json');
    const result = await parseSpec(raw, 'openapi3');
    const hasEmptyWarning = result.validationErrors.some(
      (e) =>
        e.severity === 'warning' &&
        (e.message.toLowerCase().includes('no endpoint') ||
          e.message.toLowerCase().includes('no path') ||
          e.message.toLowerCase().includes('empty')),
    );
    expect(hasEmptyWarning).toBe(true);
  });

  it('still returns a valid (though empty) NormalizedSpec on empty-spec', async () => {
    const raw = fixture('empty-spec.json');
    const result = await parseSpec(raw, 'openapi3');
    // success may be true (parsed) but endpoints empty
    expect(result.spec).toBeDefined();
    expect(result.spec?.endpoints?.length ?? 0).toBe(0);
  });
});
