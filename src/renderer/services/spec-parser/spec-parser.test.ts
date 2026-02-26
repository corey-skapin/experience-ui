import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseSpec, detectFormat } from './spec-parser';
import type { NormalizedSpec, ValidationError } from '../../../shared/types';

const FIXTURES_DIR = join(__dirname, '../../../../tests/fixtures');

function loadFixture(name: string): string {
  return readFileSync(join(FIXTURES_DIR, name), 'utf-8');
}

describe('detectFormat', () => {
  it('detects openapi3 when openapi field is present', () => {
    const raw = JSON.stringify({
      openapi: '3.0.3',
      info: { title: 'Test', version: '1.0' },
      paths: {},
    });
    expect(detectFormat(raw)).toBe('openapi3');
  });

  it('detects swagger2 when swagger field is present', () => {
    const raw = JSON.stringify({
      swagger: '2.0',
      info: { title: 'Test', version: '1.0' },
      paths: {},
    });
    expect(detectFormat(raw)).toBe('swagger2');
  });

  it('detects graphql when "type Query" is present in string', () => {
    const raw = 'type Query {\n  hello: String\n}';
    expect(detectFormat(raw)).toBe('graphql');
  });

  it('returns null for unrecognized format (RAML)', () => {
    const raw = '#%RAML 1.0\ntitle: Test API';
    expect(detectFormat(raw)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(detectFormat('')).toBeNull();
  });
});

describe('parseSpec — OpenAPI 3.x', () => {
  it('parses the openapi3-valid.json fixture and returns a NormalizedSpec', async () => {
    const raw = loadFixture('openapi3-valid.json');
    const result = await parseSpec(raw);
    expect(result.success).toBe(true);
    const spec = (result as { success: true; spec: NormalizedSpec }).spec;
    expect(spec.format).toBe('openapi3');
    expect(spec.metadata.title).toBeTruthy();
    expect(spec.endpoints).toBeDefined();
    expect(Array.isArray(spec.endpoints)).toBe(true);
    expect((spec.endpoints ?? []).length).toBeGreaterThan(0);
  });

  it('populates endpoint method and path fields', async () => {
    const raw = loadFixture('openapi3-valid.json');
    const result = await parseSpec(raw);
    expect(result.success).toBe(true);
    const spec = (result as { success: true; spec: NormalizedSpec }).spec;
    const endpoint = spec.endpoints?.[0];
    expect(endpoint).toBeDefined();
    expect(endpoint?.path).toMatch(/^\//);
    expect(['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS']).toContain(
      endpoint?.method,
    );
  });

  it('captures metadata title and version', async () => {
    const raw = loadFixture('openapi3-valid.json');
    const result = await parseSpec(raw);
    expect(result.success).toBe(true);
    const spec = (result as { success: true; spec: NormalizedSpec }).spec;
    expect(spec.metadata.title).toBe('Pet Store API');
    expect(spec.metadata.version).toBeTruthy();
  });
});

describe('parseSpec — Swagger 2.0', () => {
  it('converts swagger 2.0 spec and returns NormalizedSpec with format swagger2', async () => {
    const raw = loadFixture('swagger2-valid.json');
    const result = await parseSpec(raw);
    expect(result.success).toBe(true);
    const spec = (result as { success: true; spec: NormalizedSpec }).spec;
    expect(spec.format).toBe('swagger2');
    expect(spec.endpoints).toBeDefined();
    expect((spec.endpoints ?? []).length).toBeGreaterThan(0);
  });

  it('preserves endpoint paths from swagger 2.0 spec', async () => {
    const raw = loadFixture('swagger2-valid.json');
    const result = await parseSpec(raw);
    expect(result.success).toBe(true);
    const spec = (result as { success: true; spec: NormalizedSpec }).spec;
    const paths = (spec.endpoints ?? []).map((e) => e.path);
    expect(paths.length).toBeGreaterThan(0);
    paths.forEach((p) => expect(p).toMatch(/^\//));
  });
});

describe('parseSpec — GraphQL', () => {
  it('parses GraphQL schema and returns NormalizedSpec with queries', async () => {
    const raw = loadFixture('graphql-valid.graphql');
    const result = await parseSpec(raw);
    expect(result.success).toBe(true);
    const spec = (result as { success: true; spec: NormalizedSpec }).spec;
    expect(spec.format).toBe('graphql');
    expect(spec.queries).toBeDefined();
    expect((spec.queries ?? []).length).toBeGreaterThan(0);
  });

  it('parses GraphQL schema and returns mutations', async () => {
    const raw = loadFixture('graphql-valid.graphql');
    const result = await parseSpec(raw);
    expect(result.success).toBe(true);
    const spec = (result as { success: true; spec: NormalizedSpec }).spec;
    expect(spec.mutations).toBeDefined();
    expect((spec.mutations ?? []).length).toBeGreaterThan(0);
  });

  it('maps query names from the schema', async () => {
    const raw = loadFixture('graphql-valid.graphql');
    const result = await parseSpec(raw);
    expect(result.success).toBe(true);
    const spec = (result as { success: true; spec: NormalizedSpec }).spec;
    const queryNames = (spec.queries ?? []).map((q) => q.name);
    expect(queryNames).toContain('products');
  });
});

describe('parseSpec — validation errors', () => {
  it('returns ValidationError[] for invalid/malformed spec', async () => {
    const raw = loadFixture('invalid-malformed.json');
    const result = await parseSpec(raw);
    expect(result.success).toBe(false);
    const errors = (result as { success: false; errors: ValidationError[] }).errors;
    expect(Array.isArray(errors)).toBe(true);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('validation errors contain path and message fields', async () => {
    const raw = loadFixture('invalid-malformed.json');
    const result = await parseSpec(raw);
    expect(result.success).toBe(false);
    const errors = (result as { success: false; errors: ValidationError[] }).errors;
    const firstError = errors[0];
    expect(firstError).toHaveProperty('path');
    expect(firstError).toHaveProperty('message');
    expect(firstError).toHaveProperty('severity');
  });
});

describe('parseSpec — unsupported format', () => {
  it('rejects RAML with an error and suggestion', async () => {
    const raw = '#%RAML 1.0\ntitle: My API\nversion: v1';
    const result = await parseSpec(raw);
    expect(result.success).toBe(false);
    const errors = (result as { success: false; errors: ValidationError[] }).errors;
    expect(errors.length).toBeGreaterThan(0);
    const messages = errors.map((e) => e.message).join(' ');
    expect(messages.toLowerCase()).toMatch(/unsupported|raml|not supported/);
  });

  it('rejects WSDL with an error', async () => {
    const raw =
      '<?xml version="1.0"?><definitions xmlns="http://schemas.xmlsoap.org/wsdl/"></definitions>';
    const result = await parseSpec(raw);
    expect(result.success).toBe(false);
  });
});

describe('parseSpec — empty spec', () => {
  it('returns error when spec has no endpoints', async () => {
    const raw = loadFixture('empty-spec.json');
    const result = await parseSpec(raw);
    expect(result.success).toBe(false);
    const errors = (result as { success: false; errors: ValidationError[] }).errors;
    expect(errors.length).toBeGreaterThan(0);
    const messages = errors.map((e) => e.message).join(' ');
    expect(messages.toLowerCase()).toMatch(/empty|no endpoints|no operations/);
  });
});
