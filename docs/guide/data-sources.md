# Data sources

_Audience: people whose models are not all in one store, for example records owned by an external service next to database tables._

```js
defineConfig({
  transform: {
    dataSources: {
      db: { type: "dsqlbase", default: true },
      integrations: { type: "service" },
    },
  },
});
```

A **data source** is a store that holds models. Every stored model (a `@model` that is not `@clientOnly`) is in one source. gqlbase only records which: capability plugins read it and generate code for the models of the source types they handle. Talking to a source (a service client, its transport, its contract) is the application's concern. A service imports the shared schema types and Zod schemas, which already hold every shape.

The `dataSources` [transformer option](./configuration.md#transformer-options) registers the core `DataSourcesPlugin` (`packages/core/src/plugins/DataSourcesPlugin/DataSourcesPlugin.ts`), right after `ModelPlugin`. Without it, `@dataSource` is not declared, and every stored model is handled by every capability plugin, as if all were in one source.

## Sources

| Key | Type | Description |
| --- | --- | --- |
| `type` | `string` | What the store is. Core never reads it; each capability plugin matches the types it handles (dsqlbase: `"dsqlbase"`). A type no plugin handles is valid, and nothing is generated for its models. |
| `default` | `boolean` | Puts every stored model without `@dataSource` in this source. At most one source is the default. |

The config is checked when the transformer is created, and the transform throws on:
- more than one default source;
- a source name that is not a GraphQL enum value;
- a source without a `type`.

## `@dataSource`

```graphql
enum DataSource { db integrations }   # the keys of transform.dataSources
directive @dataSource(name: DataSource!) on OBJECT
```

```graphql
type Vendor @model { … }                                       # the default source, db
type Integration @model @dataSource(name: integrations) { … }   # integrations
```

- `@dataSource` goes on stored models. On any other type it throws, and so does a name that is not a declared source.
- A stored model without `@dataSource` is in the default source. With no default, the transform throws.
- `@dataSource` and `DataSource` are removed from the output schema.

**Nothing else depends on the source.** A model gets the same operations, `Node`, filters, tenancy claims and relation keys in any source, and keys work the same between models in different sources. The public schema, the schema types, the Zod schemas and the AppSync resolver typings are identical with or without data sources.

**A source is not visibility.** `@clientOnly @model` is still a type the client resolves: it is in no source and has no relation keys. A model in a service source is stored, just not by a generator in this config.

For generators, from `@gqlbase/core/plugins`:
- `getDataSource(model, context.options)` returns `{ name, type }` for a stored model, and `null` for a type that is not stored or when no source is declared;
- `isInDataSourceType(model, context.options, type)` is what a capability plugin that stores models tests: a stored model whose source has `type`, or any stored model when no source is declared.

Both read `@dataSource`, so call them before `cleanup`, for example in `generate`.

## Generators

- **dsqlbase** emits a table for each model of the source with `type: "dsqlbase"`, and throws when more than one source has that type. A relation to a model in another source keeps its key column but gets no `belongsTo`/`hasMany`. `@index` and `@unique` apply to its tables only. See [dsqlbase](./dsqlbase.md).
- **Drizzle** is frozen and ignores data sources: it emits every model, as before.
- Every other generator works on the public schema and is not affected.

## Global ids

A model in a service source can have a [`GUID`](./scalars.md#guid) id like any other, but the service owns its ids: dsqlbase never sees them. For `Query.node` to reach such a model, the service hands out wrapped ids itself, with a node key of its choosing:

```ts
import { encodeGlobalId } from "dsqlbase";

const id = encodeGlobalId("integrations", { id: randomUUID() });
```

The `node` resolver dispatches on `decodeGlobalId(id).key`: the service's key goes to the service, any other to `$findByGlobalId` (see [Relay](./relay.md#node-interface)). A dsqlbase column that keys into such a model is `text()`, so it stores the id exactly as the service gave it (see [dsqlbase](./dsqlbase.md#global-ids)).

## Related

- [Configuration](./configuration.md#transformer-options)
- [Models](./models.md)
- [Field visibility](./field-visibility.md)
- [dsqlbase](./dsqlbase.md)
