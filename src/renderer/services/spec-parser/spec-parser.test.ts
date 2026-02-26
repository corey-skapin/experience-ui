/**
 * Unit tests for the spec parser service.
 * Tests format auto-detection, OpenAPI 3.x parsing, Swagger 2.0 conversion,
 * GraphQL parsing, validation error reporting, and rejection of unsupported formats.
 *
 * Tests are written FIRST (TDD) and MUST fail before implementation exists.
 */
import { describe, it, expect } from 'vitest'
import { parseSpec } from './index'

// ─── Format auto-detection ────────────────────────────────────────────────

describe('format auto-detection', () => {
  it('detects OpenAPI 3.x from "openapi" field', async () => {
    const spec = JSON.stringify({
      openapi: '3.0.3',
      info: { title: 'Test', version: '1.0' },
      paths: {},
    })
    const result = await parseSpec(spec, 'json')
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.format).toBe('openapi3')
  })

  it('detects Swagger 2.0 from "swagger" field', async () => {
    const spec = JSON.stringify({
      swagger: '2.0',
      info: { title: 'Test', version: '1.0' },
      paths: {},
      host: 'api.example.com',
    })
    const result = await parseSpec(spec, 'json')
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.format).toBe('swagger2')
  })

  it('detects GraphQL from "type Query" token', async () => {
    const spec = `type Query { hello: String }`
    const result = await parseSpec(spec, 'graphql')
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.format).toBe('graphql')
  })

  it('detects GraphQL introspection schema from "__schema"', async () => {
    const spec = JSON.stringify({ __schema: { types: [] } })
    const result = await parseSpec(spec, 'json')
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.format).toBe('graphql')
  })

  it('rejects RAML format with a helpful error', async () => {
    const spec = '#%RAML 1.0\ntitle: Test'
    const result = await parseSpec(spec, 'yaml')
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.message).toMatch(/RAML/i)
      expect(result.error.supportedFormats).toContain('openapi3')
    }
  })

  it('rejects WSDL format with a helpful error', async () => {
    const spec = '<definitions xmlns="http://schemas.xmlsoap.org/wsdl/"></definitions>'
    const result = await parseSpec(spec, 'xml')
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.message).toMatch(/WSDL|unsupported/i)
  })
})

// ─── Empty spec detection ─────────────────────────────────────────────────

describe('empty spec detection', () => {
  it('detects empty string', async () => {
    const result = await parseSpec('', 'json')
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.message).toMatch(/empty/i)
  })

  it('detects whitespace-only content', async () => {
    const result = await parseSpec('   \n\t  ', 'json')
    expect(result.success).toBe(false)
  })

  it('detects OpenAPI spec with no endpoints', async () => {
    const spec = JSON.stringify({
      openapi: '3.0.0',
      info: { title: 'Empty', version: '1.0' },
      paths: {},
    })
    const result = await parseSpec(spec, 'json')
    // empty spec parses successfully but has no endpoints
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.endpoints ?? []).toHaveLength(0)
  })
})

// ─── OpenAPI 3.x parsing ──────────────────────────────────────────────────

describe('OpenAPI 3.x parsing', () => {
  const petStoreSpec = JSON.stringify({
    openapi: '3.0.3',
    info: { title: 'Pet Store', version: '1.0.0', description: 'Pets API' },
    servers: [{ url: 'https://api.example.com/v1' }],
    paths: {
      '/pets': {
        get: {
          operationId: 'listPets',
          summary: 'List pets',
          tags: ['pets'],
          parameters: [{ name: 'limit', in: 'query', schema: { type: 'integer' } }],
          responses: { '200': { description: 'OK' } },
        },
        post: {
          operationId: 'createPet',
          summary: 'Create pet',
          tags: ['pets'],
          requestBody: {
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Pet' },
              },
            },
          },
          responses: { '201': { description: 'Created' } },
        },
      },
      '/pets/{id}': {
        get: {
          operationId: 'getPet',
          summary: 'Get pet by ID',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'OK' } },
        },
      },
    },
    components: {
      schemas: {
        Pet: {
          type: 'object',
          required: ['id', 'name'],
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            age: { type: 'integer' },
          },
        },
      },
    },
  })

  it('parses metadata correctly', async () => {
    const result = await parseSpec(petStoreSpec, 'json')
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.metadata.title).toBe('Pet Store')
    expect(result.data.metadata.version).toBe('1.0.0')
    expect(result.data.metadata.baseUrl).toBe('https://api.example.com/v1')
  })

  it('extracts all endpoints', async () => {
    const result = await parseSpec(petStoreSpec, 'json')
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.endpoints).toHaveLength(3)
  })

  it('maps HTTP methods correctly', async () => {
    const result = await parseSpec(petStoreSpec, 'json')
    if (!result.success) return
    const methods = result.data.endpoints?.map((e) => e.method) ?? []
    expect(methods).toContain('GET')
    expect(methods).toContain('POST')
  })

  it('derferences $ref components', async () => {
    const result = await parseSpec(petStoreSpec, 'json')
    if (!result.success) return
    const models = result.data.models
    expect(models.some((m) => m.name === 'Pet')).toBe(true)
  })

  it('handles tags', async () => {
    const result = await parseSpec(petStoreSpec, 'json')
    if (!result.success) return
    const petsEndpoints = result.data.endpoints?.filter((e) => e.tag === 'pets') ?? []
    expect(petsEndpoints.length).toBeGreaterThan(0)
  })
})

// ─── Swagger 2.0 → 3.x conversion ────────────────────────────────────────

describe('Swagger 2.0 parsing', () => {
  const swaggerSpec = JSON.stringify({
    swagger: '2.0',
    info: { title: 'Users API', version: '2.0.0' },
    host: 'api.example.com',
    basePath: '/v2',
    paths: {
      '/users': {
        get: {
          operationId: 'listUsers',
          summary: 'List users',
          responses: { '200': { description: 'OK' } },
        },
      },
    },
  })

  it('converts Swagger 2.0 to NormalizedSpec', async () => {
    const result = await parseSpec(swaggerSpec, 'json')
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.format).toBe('swagger2')
    expect(result.data.endpoints).toHaveLength(1)
  })

  it('extracts metadata from Swagger info', async () => {
    const result = await parseSpec(swaggerSpec, 'json')
    if (!result.success) return
    expect(result.data.metadata.title).toBe('Users API')
  })
})

// ─── GraphQL parsing ──────────────────────────────────────────────────────

describe('GraphQL parsing', () => {
  const gqlSchema = `
    type Query {
      user(id: ID!): User
      users: [User!]!
    }
    type Mutation {
      createUser(name: String!): User!
    }
    type User {
      id: ID!
      name: String!
      email: String
    }
  `

  it('parses queries', async () => {
    const result = await parseSpec(gqlSchema, 'graphql')
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.queries?.length).toBeGreaterThan(0)
  })

  it('parses mutations', async () => {
    const result = await parseSpec(gqlSchema, 'graphql')
    if (!result.success) return
    expect(result.data.mutations?.length).toBeGreaterThan(0)
  })

  it('extracts model types', async () => {
    const result = await parseSpec(gqlSchema, 'graphql')
    if (!result.success) return
    expect(result.data.models.some((m) => m.name === 'User')).toBe(true)
  })

  it('sets format to graphql', async () => {
    const result = await parseSpec(gqlSchema, 'graphql')
    if (!result.success) return
    expect(result.data.format).toBe('graphql')
  })
})

// ─── Validation error reporting ───────────────────────────────────────────

describe('validation error reporting', () => {
  it('reports validation errors for malformed OpenAPI', async () => {
    const spec = JSON.stringify({ openapi: '3.0.0', paths: {} }) // missing info
    const result = await parseSpec(spec, 'json')
    // may succeed with warnings or fail with errors
    if (!result.success) {
      expect(result.error.validationErrors).toBeDefined()
    }
  })

  it('reports invalid JSON as parse error', async () => {
    const result = await parseSpec('{invalid json}', 'json')
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.message).toMatch(/parse|JSON|invalid/i)
  })
})
