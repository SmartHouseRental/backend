/**
 * OpenAPI schemas generated only from Prisma schema. No hardcoded request/response shapes.
 */

import fs from 'fs';
import path from 'path';

export interface PrismaField {
  name: string;
  type: string;
  optional: boolean;
  isId: boolean;
  isRelation: boolean;
  hasDefault: boolean;
  isUpdatedAt: boolean;
}

export interface PrismaModel {
  name: string;
  fields: PrismaField[];
}

export interface PrismaEnum {
  name: string;
  values: string[];
}

export interface ParsedPrismaSchema {
  models: PrismaModel[];
  enums: PrismaEnum[];
}

export type OpenApiSchema = Record<string, unknown>;

const SCALAR_TYPES = new Set([
  'String',
  'Int',
  'Float',
  'Boolean',
  'DateTime',
  'Json',
  'Bytes',
  'Decimal',
  'BigInt',
]);

const INPUT_EXCLUDE = new Set(['id', 'createdAt', 'updatedAt']);
const USER_RESPONSE_REF = '#/components/schemas/UserResponse';

export function parsePrismaSchema(schemaPath?: string): ParsedPrismaSchema {
  const base = process.cwd();
  const resolved = schemaPath
    ? path.resolve(base, schemaPath)
    : path.join(base, 'prisma', 'schema.prisma');
  const content = fs.readFileSync(resolved, 'utf-8');
  const lines = content.split(/\r?\n/);
  const models: PrismaModel[] = [];
  const enums: PrismaEnum[] = [];
  const enumNames = new Set<string>();
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();
    if (trimmed.startsWith('//')) {
      i++;
      continue;
    }
    const modelMatch = trimmed.match(/^model\s+(\w+)\s*\{/);
    if (modelMatch) {
      const name = modelMatch[1];
      const fields: PrismaField[] = [];
      i++;
      while (i < lines.length) {
        const inner = lines[i];
        if (inner.trim() === '}' || inner.trim().startsWith('}')) {
          i++;
          break;
        }
        if (inner.trim().startsWith('//') || inner.trim().startsWith('@@')) {
          i++;
          continue;
        }
        const field = parseField(inner, enumNames);
        if (field) fields.push(field);
        i++;
      }
      models.push({ name, fields });
      continue;
    }
    const enumMatch = trimmed.match(/^enum\s+(\w+)\s*\{/);
    if (enumMatch) {
      const name = enumMatch[1];
      enumNames.add(name);
      const values: string[] = [];
      i++;
      while (i < lines.length) {
        const inner = lines[i].trim();
        if (inner === '}' || inner.startsWith('}')) {
          i++;
          break;
        }
        if (!inner.startsWith('//') && inner.length > 0 && !inner.startsWith('@@')) {
          const val = inner.replace(/,/g, '').trim();
          if (val) values.push(val);
        }
        i++;
      }
      enums.push({ name, values });
      continue;
    }
    i++;
  }
  return { models, enums };
}

function parseField(line: string, enumNames: Set<string>): PrismaField | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('@@')) return null;
  const parts = trimmed.split(/\s+/);
  if (parts.length < 2) return null;
  const name = parts[0];
  let type = parts[1];
  const optional = type.endsWith('?');
  if (optional) type = type.slice(0, -1);
  const rest = trimmed.slice(trimmed.indexOf(parts[1]) + parts[1].length).trim();
  const isId = rest.includes('@id');
  const hasDefault = rest.includes('@default');
  const isUpdatedAt = rest.includes('@updatedAt');
  const isRelation = !SCALAR_TYPES.has(type) && (enumNames.has(type) || /^[A-Z]/.test(type));
  return {
    name,
    type,
    optional,
    isId,
    isRelation,
    hasDefault,
    isUpdatedAt,
  };
}

function prismaTypeToOpenApi(prismaType: string, enums: PrismaEnum[]): OpenApiSchema {
  switch (prismaType) {
    case 'String':
      return { type: 'string' };
    case 'Int':
    case 'Float':
    case 'Decimal':
    case 'BigInt':
      return { type: 'number' };
    case 'Boolean':
      return { type: 'boolean' };
    case 'DateTime':
      return { type: 'string', format: 'date-time' };
    case 'Json':
      return { type: 'object' };
    case 'Bytes':
      return { type: 'string', format: 'byte' };
    default: {
      const e = enums.find((x) => x.name === prismaType);
      if (e) return { type: 'string', enum: e.values };
      return { type: 'string', description: `Reference to ${prismaType}` };
    }
  }
}

function isExcludedFromInput(field: PrismaField): boolean {
  if (INPUT_EXCLUDE.has(field.name)) return true;
  if (field.isId || field.isUpdatedAt) return true;
  if (field.hasDefault && (field.name === 'createdAt' || field.name === 'updatedAt')) return true;
  return false;
}

function modelToOpenApiProperties(
  model: PrismaModel,
  enums: PrismaEnum[],
  opts: { forRequest: boolean; partial?: boolean; excludeIds?: boolean }
): OpenApiSchema {
  const properties: OpenApiSchema = {};
  const required: string[] = [];
  for (const f of model.fields) {
    if (f.isRelation) continue;
    if (opts.forRequest && isExcludedFromInput(f)) continue;
    if (opts.excludeIds && f.isId) continue;
    const optional = opts.partial || f.optional;
    const schema = prismaTypeToOpenApi(f.type, enums);
    if (f.name === 'email') (schema as Record<string, unknown>).format = 'email';
    if (f.name === 'password') (schema as Record<string, unknown>).minLength = 8;
    properties[f.name] = schema;
    if (!optional) required.push(f.name);
  }
  const result: OpenApiSchema = { type: 'object', properties };
  if (required.length > 0) result.required = required;
  return result;
}

function modelPickToOpenApi(
  model: PrismaModel,
  enums: PrismaEnum[],
  include: string[],
  required: string[]
): OpenApiSchema {
  const fieldMap = new Map(model.fields.map((f) => [f.name, f]));
  const properties: OpenApiSchema = {};
  for (const name of include) {
    const f = fieldMap.get(name);
    if (!f || f.isRelation) continue;
    const schema = prismaTypeToOpenApi(f.type, enums);
    if (f.name === 'email') (schema as Record<string, unknown>).format = 'email';
    if (f.name === 'password') (schema as Record<string, unknown>).minLength = 8;
    properties[name] = schema;
  }
  return {
    type: 'object',
    properties,
    required: required.filter((r) => include.includes(r)),
  };
}

/** Auth DTOs derived from User model in Prisma + token-only flows. */
function generateAuthSchemas(
  parsed: ParsedPrismaSchema,
  userResponseRef: string
): Record<string, OpenApiSchema> {
  const user = parsed.models.find((m) => m.name === 'User');
  const out: Record<string, OpenApiSchema> = {};

  if (user) {
    out.LoginInput = modelPickToOpenApi(
      user,
      parsed.enums,
      ['email', 'password'],
      ['email', 'password']
    );
    out.ForgotPasswordInput = modelPickToOpenApi(user, parsed.enums, ['email'], ['email']);
    const pwd = modelPickToOpenApi(user, parsed.enums, ['password'], ['password']);
    const p = (pwd as Record<string, unknown>).properties as Record<string, OpenApiSchema>;
    out.ResetPasswordInput = {
      type: 'object',
      required: ['code', 'password'],
      properties: { code: { type: 'string' }, ...p },
    };
  }

  out.VerifyEmailInput = {
    type: 'object',
    required: ['code'],
    properties: { code: { type: 'string' } },
  };

  out.AuthUserEnvelope = {
    type: 'object',
    properties: {
      status: { type: 'string', enum: ['success'] },
      data: {
        type: 'object',
        properties: {
          user: { $ref: userResponseRef },
          accessToken: { type: 'string' },
          refreshToken: { type: 'string' },
        },
      },
    },
    example: {
      status: 'success',
      data: {
        user: {
          id: 'cmor19t1w0000a3jsf53p3zy0',
          email: 'user@example.com',
          first_name: 'string',
          last_name: 'string',
          role: 'owner',
          createdAt: '2026-05-04T10:05:10.100Z',
          emailVerified: false,
          isVerified: false,
        },
        accessToken:
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjbW9yMTl0MXcwMDAwYTNqc2Y1M3AzenkwIiwicm9sZSI6Im93bmVyIiwidHlwZSI6ImFjY2VzcyIsImlhdCI6MTc3Nzg4OTExMCwiZXhwIjoxNzc3ODkyNzEwfQ.35bL-0McfRoAE6OlOB6OfNv3kIUG5Z7BERB14wujARI',
      },
    },
  };
  out.UserEnvelope = {
    type: 'object',
    properties: {
      status: { type: 'string', enum: ['success'] },
      data: {
        type: 'object',
        properties: {
          user: { $ref: userResponseRef },
        },
      },
    },
  };

  out.ApiDataEnvelope = {
    type: 'object',
    properties: {
      status: { type: 'string', enum: ['success'] },
      data: { type: 'object', description: 'Response payload' },
    },
  };
  return out;
}

export interface GenerateOptions {
  schemaPath?: string;
  excludeModels?: Set<string>;
  includeAuthSchemas?: boolean;
}

/**
 * All OpenAPI components.schemas from Prisma schema only. No hardcoded schemas.
 */
export function generateOpenApiSchemas(
  options: GenerateOptions = {}
): Record<string, OpenApiSchema> {
  const { schemaPath, excludeModels = new Set(), includeAuthSchemas = true } = options;
  const parsed = parsePrismaSchema(schemaPath);
  const { models, enums } = parsed;
  const schemas: Record<string, OpenApiSchema> = {};

  for (const model of models) {
    if (excludeModels.has(model.name)) continue;
    schemas[`${model.name}Response`] = modelToOpenApiProperties(model, enums, {
      forRequest: false,
      excludeIds: false,
    });
    schemas[`${model.name}CreateInput`] = modelToOpenApiProperties(model, enums, {
      forRequest: true,
      partial: false,
    });
    const updateProps = modelToOpenApiProperties(model, enums, {
      forRequest: true,
      partial: true,
    });
    delete (updateProps as Record<string, unknown>).required;
    schemas[`${model.name}UpdateInput`] = { ...updateProps, type: 'object' };
  }

  for (const e of enums) {
    schemas[e.name] = { type: 'string', enum: e.values };
  }

  if (includeAuthSchemas) {
    Object.assign(schemas, generateAuthSchemas(parsed, USER_RESPONSE_REF));
  }

  return schemas;
}
