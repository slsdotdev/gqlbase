# AppSync

_Audience: people deploying the generated schema to AWS AppSync and writing resolvers with `@middy-appsync/graphql`._

```js
import { appsyncPreset } from "@gqlbase/plugins";

appsyncPreset({
  middyAppSync: { authorizationModes: ["cognito", "iam"] },
});
```

Defined in `packages/plugins/src/appsync/appSyncPreset.ts`.

| Option | Default | Description |
| --- | --- | --- |
| `emitOutput` | `false` | Also return the AppSync SDL from `transform()` as `output.appsync.schema`. |
| `scalarMappings` | `{}` | Scalar name → AppSync scalar (`AWSDate`, `AWSDateTime`, `AWSTime`, `AWSTimestamp`, `AWSEmail`, `AWSJSON`, `AWSURL`, `AWSPhone`, `AWSIPAddress`, `Long`) or GraphQL built-in (`ID`, `String`, `Int`, `Float`, `Boolean`). Overrides the type hint; needed only for a scalar without one. See [`appsync/schema.graphql`](#appsyncschemagraphql). |
| `middyAppSync.enable` | `true` | Register `MiddyAppSyncGraphQLPlugin`. |
| `middyAppSync.authorizationModes` | none | Any of `cognito`, `iam`, `oidc`, `apiKey`, `lambda`. |
| `middyAppSync.resolvers` | `"declared"` | `"declared"` or `"all"`. See [`Definition`](#definition). |
| `dynamoDBFilter` | `false` | Emit `appsync/dynamodb-filter.ts`. See [DynamoDB filters](#dynamodb-filters). |

## AppSync scalars and directives

`AppSyncUtilsPlugin` (`packages/plugins/src/appsync/AppSyncUtilsPlugin/AppSyncUtilsPlugin.ts`) declares:

- **AWS scalars**, each with a type hint, so they can be used directly in your SDL: `AWSDate`, `AWSDateTime`, `AWSTime`, `AWSTimestamp`, `AWSEmail`, `AWSJSON`, `AWSURL`, `AWSPhone`, `AWSIPAddress`, and `Long` (a 64-bit integer, hint `number`), which [`SafeInt`](./scalars.md#safeint) maps to.
- **Auth and subscription directives:**
  - `@aws_subscribe(mutations: [String!]!)`
  - `@aws_auth(cognito_groups:)`
  - `@aws_cognito_user_pools(cognito_groups:)`
  - `@aws_api_key`
  - `@aws_iam`
  - `@aws_oidc`
  - `@aws_lambda`

## `appsync/schema.graphql`

`AppSyncSchemaGeneratorPlugin` rebuilds the final document into an AppSync-compatible SDL in its `output()` step, after cleanup:

- scalar definitions, directive definitions and `@gqlbase_internal` definitions are dropped (AppSync provides its own scalars);
- only `@aws_*` directives are kept, so `@semanticNonNull` is dropped;
- descriptions are dropped;
- every field and argument type is mapped:
  1. `scalarMappings`;
  2. GraphQL built-ins as is;
  3. [built-in gqlbase scalars](./scalars.md#built-in-scalars) via their AppSync mapping (`UUID` → `ID`, `DateTime` → `AWSDateTime`, `SafeInt` → `Long`, …);
  4. any other scalar by its [type hint](./scalars.md#type-hints): `id` → `ID`, `string` → `String`, `number` → `Float`, `boolean` → `Boolean`, `object` → `AWSJSON`.

A custom scalar with a hint needs no configuration. `scalarMappings` overrides the hint, for example `scalarMappings: { Currency: "String" }`. **A scalar whose hint is `unknown` (or missing) must be in `scalarMappings`, or the transform throws** with an error naming the scalar.

The hints are read during `generate`, because cleanup removes `@gqlbase_typehint` before `output()` rebuilds the schema.

## Resolver types

`MiddyAppSyncGraphQLPlugin` writes `appsync/middy-appsync.types.ts`: the types resolvers build their values with, and the `Definition` of `@middy-appsync/graphql`. Resolver code imports every type from this file.

### AppSync types

Each public object, interface and union has an **AppSync version under its schema name**, built from the [schema types](./configuration.md#schema-types)' parts with four exported utilities:

```ts
export type WithTypename<T, N extends string> = T & { __typename?: N };
export type WithRequiredTypename<T, N extends string> = T & { __typename: N };
export type WithOptional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
export type Override<T, U> = Omit<T, keyof U> & U;

export type Money = WithTypename<MoneyOwnFields, "Money">;
export type Product = WithTypename<
  WithOptional<ProductOwnFields, "reviewCount"> & { vendor?: Vendor; variants?: ProductVariantConnection },
  "Product"
>;
export type ProductEdge = WithTypename<Override<ProductEdgeOwnFields, { node: Product }>, "ProductEdge">;
export type SearchResult = WithRequiredTypename<ProductSearchHit, "ProductSearchHit"> | WithRequiredTypename<MarketLocationSearchHit, "MarketLocationSearchHit">;
```

- **An object** is its `<Type>OwnFields`, with:
  - its relations, always optional and typed with the AppSync versions, so a resolver can return preloaded relations;
  - its [`@computed`](#computed-fields) fields optional, since they have their own resolver;
  - `__typename` allowed.
- **An own field whose type differs here** is overridden with `Override`: one that holds a union, an interface or a type with `@computed` fields, at any depth (`ProductEdge.node` above). Every other own field is the schema types' own.
- **A union, or an interface,** requires `__typename` on each member (each public type implementing the interface), so AppSync can resolve it.
- **Re-exports.** Enums, inputs and `Scalars` are re-exported from the schema types as they are. The `<Type>OwnFields` parts are only imported, to build the AppSync versions.
- A schema type named like a utility (`Override`) or a source type (`ProductSource`) throws.

### `Definition`

```ts
declare module "@middy-appsync/graphql" {
  interface Definition {
    Query: {
      getPost: { source: null; args: { id: Scalars["ID"]["input"] }; result: Maybe<Post> };
    };
    Post: {
      author: { source: PostSource; args: Record<string, never>; result: Maybe<User> };
    };
  }
  interface Authorization {
    allow: AppSyncIdentityCognito | AppSyncIdentityIAM;
  }
}
```

- **`source`** is `null` for root types. Otherwise it is what the parent field's resolver returned: the parent's AppSync version, or `<Type>Source` when the parent has hidden stored fields (`@serverOnly` and `@writeOnly` fields and relation keys). `<Type>Source` is the AppSync version plus those fields, since a parent resolver usually returns the stored row:

  ```ts
  export type PostSource = Post & {
    authorId?: Maybe<Scalars["ID"]["output"]>;
    deletedAt?: Maybe<Scalars["AWSDateTime"]["output"]>;
  };
  ```

  Hidden relation fields are not part of the row (their key is), so they are left out. A hidden field whose type is not in the schema types is declared in this file.
- **`args`** use the input side of each scalar (`Scalars["AWSJSON"]["input"]` is a string), and **`result`** the output side and the AppSync versions.
- **Which fields get an entry:**
  - with `resolvers: "declared"` (the default), the fields that have their own resolver: every field of `Query`, `Mutation` and `Subscription`, every relation field (`@hasOne`, `@hasMany`, `@belongsTo`), and every `@computed` field;
  - with `resolvers: "all"`, every field.

  **An entry does not register a resolver.** AppSync calls a resolver for a field only if one is attached to it; otherwise it takes the value from `source`. `"all"` only lets resolvers be written for more fields: the fields a parent may leave out are the same in both modes.
- `Authorization` is emitted only when `authorizationModes` is set. It imports the identity types from `aws-lambda`; `apiKey` contributes `null`.
- **Only public fields get an entry** (`isPublicSchemaField`, see [Field visibility](./field-visibility.md)), so `@serverOnly` operations are not listed. Types that are not in the output schema get no entry.

The file only provides types. Resolver implementations and data access are up to the application.

### Computed fields

`MiddyAppSyncGraphQLPlugin` declares `@computed`:

```graphql
directive @computed on FIELD_DEFINITION
```

It marks a field that has its own resolver. The field gets an entry under `resolvers: "declared"`, and is optional in its type's AppSync version, so the resolver that returns the parent may leave it out. The schema keeps the field as declared, non-null included; the directive is removed from every output.

`@computed` says nothing about storage, so it combines with [field visibility](./field-visibility.md):

```graphql
type Product @model {
  id: ID!
  # Not stored: always computed.
  reviewCount: Int! @computed @clientOnly
  # Stored: a column the resolver returns once it is set, computing the value until then.
  summary: ProductSummary @computed
}
```

It throws on a field of `Query`, `Mutation` or `Subscription` and on a relation field, which have their own resolver already, and on a field that is not in the public schema (`@serverOnly`, `@writeOnly`), which AppSync never resolves.

## DynamoDB filters

With `dynamoDBFilter: true`, `AppSyncDynamoDBFilterPlugin` (`packages/plugins/src/appsync/AppSyncDynamoDBFilterPlugin/`) emits `appsync/dynamodb-filter.ts`. Its `toDynamoDBFilter(filter)` turns a generated filter input into the `filter` of a DynamoDB `Query` or `Scan` request in an APPSYNC_JS resolver:

```ts
import { toDynamoDBFilter } from "../generated/appsync/dynamodb-filter";

export function request(ctx) {
  return { operation: "Scan", filter: toDynamoDBFilter(ctx.args.filter) };
}
```

It sanitizes the filter for `util.transform.toDynamoDBFilterExpression`, calls it, and returns the parsed result, or `null` when no condition is left. It imports `util` from `@aws-appsync/utils`, so bundle it with the resolver as usual.

- **Operators are renamed** to AppSync's: `neq` → `ne`, `lte` → `le`, `gte` → `ge`, `exists` → `attributeExists`. The others are the same. Only operator keys are renamed, never field names.
- **Nested `where` conditions are dropped**: AppSync cannot filter on nested paths. `exists` on the object field itself is kept. A field filtered only through `where` is not filtered at all on this backend.
- **Explicit `null`s are dropped**, and so are the conditions they leave empty, as on every backend.
- **`endsWith`** is not supported by DynamoDB: `util.error`.
- **`exists`** follows AppSync: `attributeExists: true` matches an attribute stored as `NULL`, unlike SQL.

APPSYNC_JS has no recursion, and its `for…of` does not visit elements appended during the loop, so the function does not walk the filter as a tree. It makes one pass over the characters of the filter's JSON, keeping a stack of the objects it is in.

## Related

- [Scalars](./scalars.md)
- [Relations](./relations.md)
- [Field visibility](./field-visibility.md)
- [Known gaps](../internals/known-gaps.md)
