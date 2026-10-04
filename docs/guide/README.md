# Guide

_Audience: people using gqlbase to generate a schema and code for their application._

gqlbase reads GraphQL SDL annotated with directives (`@model`, `@hasMany`, `@readOnly`, …), transforms it into a complete schema (queries, mutations, inputs, filters, connections), and generates code from the result (TypeScript types, Zod validators, database schema, AppSync artifacts). Everything is done by plugins; presets bundle the common ones.

These pages describe what the library does **today**. Planned behaviour is not documented here.

## Getting started

- [Install](./install.md) — packages and peer dependencies
- [Configuration](./configuration.md) — `gqlbase.config.js`, the CLI, presets and plugin order

## Schema directives

- [Models](./models.md) — `@model`, generated operations, inputs and filter inputs
- [Relations](./relations.md) — `@hasOne`, `@hasMany`, `@belongsTo`, relation keys
- [Field visibility](./field-visibility.md) — `@readOnly`, `@writeOnly`, `@serverOnly`, `@clientOnly`, `@createOnly`, `@updateOnly`, `@filterOnly`, `@constraint`, and how each generator treats them
- [Scalars](./scalars.md) — built-in scalars, `@gqlbase_typehint`, adding your own
- [Tenancy](./tenancy.md) — `@scope`, tenancy scopes and their claim fields
- [Data sources](./data-sources.md) — `@dataSource`, stores other than the database
- [Embedded objects](./embedded-objects.md) — `@embedded`, value objects stored as columns of the model that uses them

## Plugins and generators

| Page | Import | Output |
| --- | --- | --- |
| [Models](./models.md), [Relations](./relations.md) | core plugins, always registered | `schema.graphql`, `schema.types.ts` |
| [Relay](./relay.md) | core plugins, `transform.relay` | connections, `Node` |
| [Tenancy](./tenancy.md) | core plugin, `transform.tenancy` | claim fields |
| [Data sources](./data-sources.md) | core plugin, `transform.dataSources` | which models each generator emits |
| [AppSync](./appsync.md) | `@gqlbase/plugins` → `appsyncPreset` | `appsync/schema.graphql`, `appsync/middy-appsync.types.ts` |
| [Zod](./zod.md) | `@gqlbase/plugins/zod` | `zod/schema.validators.ts` |
| [dsqlbase](./dsqlbase.md) | `@gqlbase/plugins/dsql` | `dsqlbase/schema.ts` |
| [Drizzle](./drizzle.md) | `@gqlbase/plugins/drizzle` | `drizzle/schema.ts` |

## Directive quick reference

| Directive | Location | Page |
| --- | --- | --- |
| `@model(operations: [ModelOperation!])` | OBJECT | [Models](./models.md) |
| `@embedded` | OBJECT | [Embedded objects](./embedded-objects.md) |
| `@hasOne(key: String)` | FIELD_DEFINITION | [Relations](./relations.md) |
| `@hasMany(key: String)` | FIELD_DEFINITION | [Relations](./relations.md) |
| `@belongsTo(key: String)` | FIELD_DEFINITION | [Relations](./relations.md) |
| `@readOnly` `@writeOnly` | FIELD_DEFINITION | [Field visibility](./field-visibility.md) |
| `@serverOnly` `@clientOnly` | FIELD_DEFINITION, OBJECT | [Field visibility](./field-visibility.md) |
| `@createOnly` `@updateOnly` `@filterOnly` | FIELD_DEFINITION | [Field visibility](./field-visibility.md) |
| `@constraint(min: Float, max: Float, pattern: String)` | FIELD_DEFINITION, INPUT_FIELD_DEFINITION, ARGUMENT_DEFINITION | [Field visibility](./field-visibility.md) |
| `@semanticNonNull(levels: [Int!]! = [0])` | FIELD_DEFINITION | [Models](./models.md#nullability-and-semanticnonnull) |
| `@scope(name: TenancyScope!)` | OBJECT | [Tenancy](./tenancy.md) |
| `@dataSource(name: DataSource!)` | OBJECT | [Data sources](./data-sources.md) |
| `@gqlbase_typehint(type: …, input: …)` | SCALAR | [Scalars](./scalars.md) |
| `@gqlbase_internal` | most locations | [Scalars](./scalars.md#internal-definitions) |
| `@aws_*` | OBJECT, FIELD_DEFINITION | [AppSync](./appsync.md) |

## Related

- [Documentation index](../README.md)
- [Architecture](../internals/architecture.md) — how the pipeline runs the plugins
- [Known gaps](../internals/known-gaps.md)
