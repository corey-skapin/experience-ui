import { buildSchema, GraphQLSchema, GraphQLObjectType, GraphQLField } from 'graphql';
import type {
  NormalizedSpec,
  NormalizedOperation,
  NormalizedModel,
  NormalizedParameter,
  ValidationError,
} from '../../../shared/types';

export type ParseResult =
  | { success: true; spec: NormalizedSpec }
  | { success: false; errors: ValidationError[] };

function graphqlTypeToModel(type: unknown, name: string): NormalizedModel {
  if (typeof type !== 'object' || type === null) {
    return { name, type: 'string' };
  }
  const t = type as { name?: string; ofType?: unknown };
  if (t.ofType) {
    return graphqlTypeToModel(t.ofType, t.name ?? name);
  }
  return { name: t.name ?? name, type: 'object' };
}

function fieldToOperation(
  name: string,
  field: GraphQLField<unknown, unknown>,
  type: 'query' | 'mutation' | 'subscription',
): NormalizedOperation {
  const args: NormalizedParameter[] = field.args.map((arg) => ({
    name: arg.name,
    in: 'query' as const,
    type: arg.type.toString(),
    required: arg.type.toString().endsWith('!'),
    description: arg.description ?? undefined,
  }));

  return {
    name,
    type,
    description: field.description ?? undefined,
    args,
    returnType: graphqlTypeToModel(field.type, 'returnType'),
    deprecated: field.deprecationReason != null,
  };
}

function extractObjectTypes(schema: GraphQLSchema): NormalizedModel[] {
  const typeMap = schema.getTypeMap();
  const models: NormalizedModel[] = [];
  const builtins = new Set([
    'String',
    'Boolean',
    'Int',
    'Float',
    'ID',
    '__Schema',
    '__Type',
    '__Field',
    '__InputValue',
    '__EnumValue',
    '__Directive',
    'Query',
    'Mutation',
    'Subscription',
  ]);

  for (const [typeName, type] of Object.entries(typeMap)) {
    if (builtins.has(typeName) || typeName.startsWith('__')) continue;
    if (type instanceof GraphQLObjectType) {
      const fields = type.getFields();
      const properties: Record<string, NormalizedModel> = {};
      for (const [fieldName, field] of Object.entries(fields)) {
        properties[fieldName] = graphqlTypeToModel(field.type, fieldName);
      }
      models.push({ name: typeName, type: 'object', properties });
    }
  }
  return models;
}

export async function parseGraphQL(rawContent: string): Promise<ParseResult> {
  let schema: GraphQLSchema;
  try {
    schema = buildSchema(rawContent);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      errors: [{ path: '', message, severity: 'error' }],
    };
  }

  const queryType = schema.getQueryType();
  const mutationType = schema.getMutationType();
  const subscriptionType = schema.getSubscriptionType();

  const queries: NormalizedOperation[] = queryType
    ? Object.entries(queryType.getFields()).map(([name, field]) =>
        fieldToOperation(name, field, 'query'),
      )
    : [];

  const mutations: NormalizedOperation[] = mutationType
    ? Object.entries(mutationType.getFields()).map(([name, field]) =>
        fieldToOperation(name, field, 'mutation'),
      )
    : [];

  const subscriptions: NormalizedOperation[] = subscriptionType
    ? Object.entries(subscriptionType.getFields()).map(([name, field]) =>
        fieldToOperation(name, field, 'subscription'),
      )
    : [];

  if (queries.length === 0 && mutations.length === 0 && subscriptions.length === 0) {
    return {
      success: false,
      errors: [
        {
          path: '',
          message: 'GraphQL schema has no operations defined (no Query, Mutation, or Subscription)',
          severity: 'error',
        },
      ],
    };
  }

  const spec: NormalizedSpec = {
    format: 'graphql',
    metadata: {
      title: 'GraphQL API',
      version: '1.0.0',
    },
    queries,
    mutations,
    subscriptions,
    models: extractObjectTypes(schema),
  };

  return { success: true, spec };
}
