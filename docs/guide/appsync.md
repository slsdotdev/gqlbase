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
| `middyAppSync.relationsOnly` | `true` | See [Resolver types](#resolver-types). |

## AppSync scalars and directives

`AppSyncUtilsPlugin` (`packages/plugins/src/appsync/AppSyncUtilsPlugin/AppSyncUtilsPlugin.ts`) declares:

- **AWS scalars**, each with a type hint, so they can be used directly in your SDL: `AWSDate`, `AWSDateTime`, `AWSTime`, `AWSTimestamp`, `AWSEmail`, `AWSJSON`, `AWSURL`, `AWSPhone`, `AWSIPAddress`, and `Long` (a 64-bit integer, hint `bigint`), which [`SafeInt`](./scalars.md#safeint) maps to.
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
  4. any other scalar by its [type hint](./scalars.md#type-hints): `id` → `ID`, `string` → `String`, `number` → `Float`, `bigint` → `Long`, `boolean` → `Boolean`, `object` → `AWSJSON`.

A custom scalar with a hint needs no configuration. `scalarMappings` overrides the hint, for example `scalarMappings: { Currency: "String" }`. **A scalar whose hint is `unknown` (or missing) must be in `scalarMappings`, or the transform throws** with an error naming the scalar.

The hints are read during `generate`, because cleanup removes `@gqlbase_typehint` before `output()` rebuilds the schema.

## Resolver types

`MiddyAppSyncGraphQLPlugin` writes `appsync/middy-appsync.types.ts`. This file augments the `Definition` interface of `@middy-appsync/graphql` with one entry per object and interface type:

```ts
declare module "@middy-appsync/graphql" {
  interface Definition {
    Query: {
      getPost: { source: null; args: { id: string }; result: Maybe<Post> };
    };
    User: {
      posts: { source: User; args: { filter?: Maybe<PostFilterInput>; first?: Maybe<number>; after?: Maybe<string> }; result: PostConnection };
    };
  }
  interface Authorization {
    allow: AppSyncIdentityCognito | AppSyncIdentityIAM;
  }
}
```

- `source` is `null` for root types. Otherwise it is the parent type (imported from `../schema.types`), or `<Type>Source` when the parent has hidden stored fields: `@serverOnly` and `@writeOnly` fields and relation keys. `<Type>Source` is the schema type plus those fields, since a parent resolver usually returns the stored row.

  Hidden relation fields are not part of the row (their key is), so they are left out. A hidden field whose type is not in the schema types is declared in this file.

  ```ts
  export type PostSource = Post & {
    authorId?: Maybe<string>;
    deletedAt?: Maybe<string>;
  };
  ```
- **Which fields get an entry:**
  - with `relationsOnly: true` (the default), every field of `Query`, `Mutation` and `Subscription`, and every relation field (`@hasOne`, `@hasMany`, `@belongsTo`) on other types;
  - with `relationsOnly: false`, every field.

  **A `@clientOnly` scalar or object field gets no entry under the default**, so its value has to be set on the parent object by the parent's resolver.
- **Re-exports.** The file re-exports the schema types it uses (`export type { … } from "../schema.types"`), so resolver code imports its types from one place.
- `Authorization` is emitted only when `authorizationModes` is set. It imports the identity types from `aws-lambda`; `apiKey` contributes `null`.
- **Only public fields get an entry** (`isPublicSchemaField`, see [Field visibility](./field-visibility.md)), so `@serverOnly` operations are not listed. Types that are not in the output schema get no entry.

The file only provides types. Resolver implementations and data access are up to the application.

## Related

- [Scalars](./scalars.md)
- [Relations](./relations.md)
- [Field visibility](./field-visibility.md)
- [Known gaps](../internals/known-gaps.md)
