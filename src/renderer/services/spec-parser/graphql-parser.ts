/**
 * GraphQL schema parser.
 * Uses the graphql package to parse SDL or introspection schemas.
 * Transforms to NormalizedSpec with queries, mutations, subscriptions, and models.
 */
import {
  buildSchema,
  buildClientSchema,
  type GraphQLSchema,
  type GraphQLObjectType,
  type GraphQLField,
  type GraphQLNamedType,
  type GraphQLInputObjectType,
  type GraphQLEnumType,
  isObjectType,
  isInputObjectType,
  isEnumType,
  isScalarType,
  isInterfaceType,
  isUnionType,
} from 'graphql'
import type {
  NormalizedSpec,
  NormalizedOperation,
  NormalizedModel,
  NormalizedParameter,
} from '../../../shared/types'
import type { ParseResult } from './openapi-parser'

// ─── GraphQL → NormalizedModel ────────────────────────────────────────────

function typeToString(type: unknown): string {
  if (!type || typeof type !== 'object') return 'unknown'
  const t = type as { name?: string; ofType?: unknown; toString?: () => string }
  if (t.name) return t.name
  if (t.ofType) return typeToString(t.ofType)
  return t.toString?.() ?? 'unknown'
}

function normalizeGraphQLType(type: GraphQLNamedType): NormalizedModel | null {
  if (isScalarType(type) || isInterfaceType(type)) return null

  if (isEnumType(type)) {
    const enumType = type as GraphQLEnumType
    return {
      name: enumType.name,
      type: 'enum',
      description: enumType.description ?? undefined,
      enumValues: enumType.getValues().map((v) => v.value),
    }
  }

  if (isUnionType(type)) {
    return {
      name: type.name,
      type: 'union',
      description: type.description ?? undefined,
      unionOf: type.getTypes().map((t) => ({
        name: t.name,
        type: 'object' as const,
      })),
    }
  }

  if (isObjectType(type) || isInputObjectType(type)) {
    const fields = isObjectType(type)
      ? (type as GraphQLObjectType).getFields()
      : (type as GraphQLInputObjectType).getFields()

    const properties: Record<string, NormalizedModel> = {}
    for (const [fieldName, field] of Object.entries(fields)) {
      const fieldType = typeToString((field as { type: unknown }).type)
      properties[fieldName] = {
        name: fieldName,
        type: 'string',
        description: (field as { description?: string }).description ?? undefined,
        format: fieldType,
      }
    }

    return {
      name: type.name,
      type: 'object',
      description: type.description ?? undefined,
      properties,
    }
  }

  return null
}

// ─── Operations ───────────────────────────────────────────────────────────

function normalizeOperation(
  name: string,
  field: GraphQLField<unknown, unknown>,
  opType: NormalizedOperation['type'],
): NormalizedOperation {
  const parameters: NormalizedParameter[] = Object.entries(field.args ?? {}).map(
    ([argName, arg]) => ({
      name: argName,
      in: 'query' as const,
      type: typeToString(arg.type),
      required: !typeToString(arg.type).endsWith('null'),
      description: arg.description ?? undefined,
    }),
  )

  const returnTypeName = typeToString(field.type)
  const returnTypeModel: NormalizedModel = {
    name: returnTypeName,
    type: 'object',
  }

  return {
    name,
    type: opType,
    description: field.description ?? undefined,
    args: parameters,
    returnType: returnTypeModel,
  }
}

function extractOperations(
  type: GraphQLObjectType | null | undefined,
  opType: NormalizedOperation['type'],
): NormalizedOperation[] {
  if (!type) return []
  return Object.entries(type.getFields()).map(([name, field]) =>
    normalizeOperation(name, field as GraphQLField<unknown, unknown>, opType),
  )
}

// ─── Parser ───────────────────────────────────────────────────────────────

export async function parseGraphQL(content: string): Promise<ParseResult> {
  let schema: GraphQLSchema

  try {
    // Try SDL first
    const trimmed = content.trim()
    if (trimmed.startsWith('{') || trimmed.startsWith('"')) {
      // Introspection JSON
      const introspection = JSON.parse(trimmed) as {
        __schema?: unknown
        data?: { __schema?: unknown }
      }
      const schemaData = introspection.__schema ?? introspection.data?.__schema
      if (!schemaData) throw new Error('Not a valid introspection result')
      schema = buildClientSchema({ __schema: schemaData } as Parameters<
        typeof buildClientSchema
      >[0])
    } else {
      schema = buildSchema(content)
    }
  } catch (err) {
    return {
      success: false,
      error: {
        message: `GraphQL parse error: ${err instanceof Error ? err.message : String(err)}`,
      },
    }
  }

  const queries = extractOperations(schema.getQueryType() ?? undefined, 'query')
  const mutations = extractOperations(schema.getMutationType() ?? undefined, 'mutation')
  const subscriptions = extractOperations(schema.getSubscriptionType() ?? undefined, 'subscription')

  const models: NormalizedModel[] = []
  for (const type of Object.values(schema.getTypeMap())) {
    // Skip built-in types
    if (type.name.startsWith('__')) continue
    if (isScalarType(type) && ['String', 'Int', 'Float', 'Boolean', 'ID'].includes(type.name))
      continue
    if (['Query', 'Mutation', 'Subscription'].includes(type.name)) continue
    const model = normalizeGraphQLType(type)
    if (model) models.push(model)
  }

  const normalized: NormalizedSpec = {
    format: 'graphql',
    metadata: {
      title: 'GraphQL API',
      version: '1.0',
    },
    queries,
    mutations,
    subscriptions,
    models,
  }

  return { success: true, data: normalized }
}
