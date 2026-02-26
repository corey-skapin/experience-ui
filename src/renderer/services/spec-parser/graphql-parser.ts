// src/renderer/services/spec-parser/graphql-parser.ts
// T030 — GraphQL schema parser using the graphql package.
// Transforms a GraphQL SDL schema into a NormalizedSpec with queries,
// mutations, subscriptions, and models.

import {
  buildSchema,
  getNamedType,
  isEnumType,
  isInputObjectType,
  isListType,
  isNonNullType,
  isObjectType,
  isScalarType,
  isUnionType,
  type GraphQLArgument,
  type GraphQLEnumType,
  type GraphQLField,
  type GraphQLNamedType,
  type GraphQLOutputType,
} from 'graphql';

import type {
  NormalizedModel,
  NormalizedOperation,
  NormalizedParameter,
  NormalizedSpec,
  ValidationError,
} from '../../../shared/types';

// ─── Result Type ──────────────────────────────────────────────────────────────

export interface GraphQLParseResult {
  success: boolean;
  spec?: NormalizedSpec;
  validationErrors: ValidationError[];
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** The built-in GraphQL type names to exclude from user-defined models. */
const BUILT_IN_TYPES = new Set([
  'String',
  'Int',
  'Float',
  'Boolean',
  'ID',
  'Query',
  'Mutation',
  'Subscription',
  '__Schema',
  '__Type',
  '__TypeKind',
  '__Field',
  '__InputValue',
  '__EnumValue',
  '__Directive',
  '__DirectiveLocation',
]);

/**
 * Parse a GraphQL SDL schema string into a NormalizedSpec.
 *
 * @param schemaText - GraphQL SDL schema text.
 */
export function parseGraphQL(schemaText: string): GraphQLParseResult {
  let schema;
  try {
    schema = buildSchema(schemaText);
  } catch (err) {
    return {
      success: false,
      validationErrors: [
        {
          path: '',
          message: err instanceof Error ? err.message : 'Invalid GraphQL schema',
          severity: 'error',
        },
      ],
    };
  }

  const queries: NormalizedOperation[] = [];
  const mutations: NormalizedOperation[] = [];
  const subscriptions: NormalizedOperation[] = [];
  const models: NormalizedModel[] = [];

  // Extract queries
  const queryType = schema.getQueryType();
  if (queryType) {
    for (const [name, field] of Object.entries(queryType.getFields())) {
      queries.push(fieldToOperation(name, field as GraphQLField<unknown, unknown>, 'query'));
    }
  }

  // Extract mutations
  const mutationType = schema.getMutationType();
  if (mutationType) {
    for (const [name, field] of Object.entries(mutationType.getFields())) {
      mutations.push(fieldToOperation(name, field as GraphQLField<unknown, unknown>, 'mutation'));
    }
  }

  // Extract subscriptions
  const subscriptionType = schema.getSubscriptionType();
  if (subscriptionType) {
    for (const [name, field] of Object.entries(subscriptionType.getFields())) {
      subscriptions.push(
        fieldToOperation(name, field as GraphQLField<unknown, unknown>, 'subscription'),
      );
    }
  }

  // Extract user-defined object types as models
  const typeMap = schema.getTypeMap();
  for (const [name, type] of Object.entries(typeMap)) {
    if (BUILT_IN_TYPES.has(name) || name.startsWith('__')) continue;
    if (isObjectType(type) || isInputObjectType(type)) {
      models.push(objectTypeToModel(type as GraphQLNamedType));
    } else if (isEnumType(type)) {
      models.push(enumTypeToModel(type));
    }
  }

  const spec: NormalizedSpec = {
    format: 'graphql',
    metadata: {
      title: 'GraphQL API',
      version: '1.0.0',
    },
    queries: queries.length > 0 ? queries : undefined,
    mutations: mutations.length > 0 ? mutations : undefined,
    subscriptions: subscriptions.length > 0 ? subscriptions : undefined,
    models,
  };

  return { success: true, spec, validationErrors: [] };
}

// ─── Field → Operation ────────────────────────────────────────────────────────

function fieldToOperation(
  name: string,
  field: GraphQLField<unknown, unknown>,
  type: 'query' | 'mutation' | 'subscription',
): NormalizedOperation {
  return {
    name,
    type,
    description: field.description ?? undefined,
    args: field.args.map(argToParameter),
    returnType: outputTypeToModel(field.type),
    deprecated: field.deprecationReason !== null && field.deprecationReason !== undefined,
  };
}

// ─── Argument → Parameter ─────────────────────────────────────────────────────

function argToParameter(arg: GraphQLArgument): NormalizedParameter {
  const required = isNonNullType(arg.type);
  const namedType = getNamedType(arg.type);
  return {
    name: arg.name,
    in: 'query', // GraphQL args don't have HTTP location; use 'query' as convention
    type: namedType?.name ?? 'String',
    required,
    description: arg.description ?? undefined,
  };
}

// ─── Type → Model ─────────────────────────────────────────────────────────────

function outputTypeToModel(gqlType: GraphQLOutputType): NormalizedModel {
  // Unwrap NonNull wrapper
  if (isNonNullType(gqlType)) {
    return outputTypeToModel(gqlType.ofType);
  }
  // Unwrap List wrapper
  if (isListType(gqlType)) {
    return {
      name: 'list',
      type: 'array',
      items: outputTypeToModel(gqlType.ofType),
    };
  }
  // Named type
  const named = getNamedType(gqlType);
  if (!named) return { name: 'unknown', type: 'string' };

  if (isScalarType(named)) {
    return { name: named.name, type: scalarToModelType(named.name) };
  }
  if (isObjectType(named)) {
    return { name: named.name, type: 'object' };
  }
  if (isEnumType(named)) {
    return {
      name: named.name,
      type: 'enum',
      enumValues: named.getValues().map((v) => v.name),
    };
  }
  if (isUnionType(named)) {
    return {
      name: named.name,
      type: 'union',
      unionOf: named.getTypes().map((t) => ({ name: t.name, type: 'object' as const })),
    };
  }
  return { name: named.name, type: 'object' };
}

function scalarToModelType(name: string): NormalizedModel['type'] {
  switch (name) {
    case 'Int':
      return 'integer';
    case 'Float':
      return 'number';
    case 'Boolean':
      return 'boolean';
    case 'ID':
      return 'string';
    default:
      return 'string';
  }
}

function objectTypeToModel(type: GraphQLNamedType): NormalizedModel {
  const model: NormalizedModel = { name: type.name, type: 'object' };
  if ('description' in type && type.description) {
    model.description = type.description;
  }
  if ('getFields' in type && typeof type.getFields === 'function') {
    const fields = type.getFields() as Record<
      string,
      { name: string; type: GraphQLOutputType; description?: string | null }
    >;
    model.properties = Object.fromEntries(
      Object.entries(fields).map(([k, f]) => [k, outputTypeToModel(f.type)]),
    );
  }
  return model;
}

function enumTypeToModel(type: GraphQLEnumType): NormalizedModel {
  return {
    name: type.name,
    type: 'enum',
    description: type.description ?? undefined,
    enumValues: type.getValues().map((v) => v.name),
  };
}
