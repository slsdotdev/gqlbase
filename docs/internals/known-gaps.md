# Known gaps

_Audience: contributors and agents. Read this before designing a feature._

These are verified defects and inconsistencies in the current code. **Fix them; do not design around them.** If a feature touches one, the fix is a prerequisite story in that feature's proposal ([Conventions → Design workflow](./conventions.md#design-workflow)). When a gap is fixed, delete its entry in the same PR.

## Schema transformation

### 2. Union relation targets always get an `ID!` key

When a relation target is a union, `RelationsPlugin._setRelationKey` (`packages/core/src/plugins/RelationsPlugin/RelationsPlugin.ts`) recurses into each member. The recursive call passes only `key`, dropping `typeName` and `isNullable`. Every member therefore gets a non-null `ID` key field, whatever the relation's nullability or the id type `_getKeyTypeName` resolved.

**Fix:** forward both arguments.

### 3. `RelationsPlugin` docstring contradicts the key placement

The class docstring shows `author: User @hasOne` on `Post` adding `authorId` to `Post`. The code (`parseFieldRelation` in `packages/core/src/plugins/RelationsPlugin/RelationsPlugin.utils.ts`, plus `normalize`) does something else. Without an explicit key, `@hasOne` derives `camelCase(<parent>, "id")` and places it on the **target**, so the example actually adds `postId` to `User`. Only `@belongsTo` puts the key on the source, as `camelCase(<field>, "id")`.

**Fix:** correct the docstring. The documented behaviour is in [Relations](../guide/relations.md).

### 4. `@gqlbase_typehint` argument and docs are inconsistent

In `packages/core/src/plugins/InternalUtilsPlugin/`:
- The `type` argument is declared `String!`. But `getTypeHint` reads only **enum** values (`@gqlbase_typehint(type: string)`), and every built-in usage passes an enum. A string literal (`type: "string"`) is silently ignored and resolves to `"unknown"`.
- It passes validation because `validateSDL` does not check argument value types.
- The `getTypeHint` docstring says the default is `"string"`; the code returns `"unknown"`.
- The `TypeHint` enum listed in the plugin docstring omits `object`.

**Fix:** declare the argument as `TypeHint!`, align the docstrings, and decide whether string literals should be accepted.

### 5. Object-like fields cannot be filtered

`ModelPlugin._createFilterInput` (`packages/core/src/plugins/ModelPlugin/ModelPlugin.ts`) skips every field whose type is object-like: object, interface or union. Non-model object fields, union relations and interface fields never appear in `<Model>FilterInput`.

### 6. `SortDirection` is generated but never used

`ModelPlugin.before` adds `enum SortDirection { ASC DESC }` to every document. No generated field or input references it, and list queries have no sort argument (a `TODO: Handle sort input` sits beside `_createListQueryField`). Because nothing reaches it, `SchemaGeneratorPlugin` drops it from the output and the generators skip it, but it is still created on every run.

### 7. Type extensions of undeclared types are dropped silently

`DocumentNode.fromDefinition` (`packages/core/src/definition/DocumentNode.ts`) applies `extend type X` only when `X` exists in the **same** parsed document. An extension of a type declared nowhere in the source is dropped without an error. This includes a root type that a plugin would create later, such as `extend type Mutation` with no `type Mutation`.

### 8. Relations on types without an `id` throw

A relation field on a non-model type that has no `id` field throws "does not have an id field" in `RelationsPlugin`, even when `key:` is given. An example is `posts: [Post] @hasMany` on a `Viewer` root. Only `@clientOnly` relation fields avoid it. The error message suggests "a key directive with an explicit type", which does not exist.

### 9. `@writeOnly` fields appear in filter inputs

`shouldSkipFieldFromFilterInput` (`packages/core/src/plugins/ModelPlugin/ModelPlugin.utils.ts`) does not skip `@writeOnly`, so clients can filter on a value they cannot read.

### 10. `@constraint` survives on inputs after its definition is removed

Cleanup removes the `@constraint` directive definition. The directive's usages on input fields and arguments stay in the output SDL, so the printed schema is invalid.

### 11. Nested `<Type>Input` is shared across operations

A non-model object field gets a nested `<Type>Input` built with the rules of whichever operation reaches it first (`ModelPlugin.ts`). Every operation then reuses that input. For example, the update input inherits non-null fields from the create input.

### 12. List filter inputs are inconsistent

`[String]` fields get `StringFilterInput` rather than a list filter. `<Type>ListFilterInput` is created only when no `<Type>FilterInput` exists yet.

## Code generation

### 14. Drizzle emits `json`, not `jsonb`

`DrizzleSchemaGeneratorPlugin` (`packages/plugins/src/drizzle/DrizzleSchemaGeneratorPlugin/DrizzleSchemaGeneratorPlugin.ts`) emits `json("<col>").$type<T>()` for non-model object fields. Its test is titled "generates jsonb()…" but asserts `json(`. The typehint map in `DrizzleSchemaGeneratorPlugin.utils.ts` maps `object` to `"jsonb"`, so the two paths disagree.

The same plugin also ignores its `dialect` option, and it uses a union's name as a table variable when a relation targets a union.

### 17. `dsqlbase()` factory takes no options

`dsqlbase()` (`packages/plugins/src/dsql/index.ts`) passes no options to `DsqlBaseSchemaGeneratorPlugin`, so `scalarMap` and `emitOutput` cannot be set from a config.

## Tooling

### 18. Source files are concatenated without a separator

`definitionFromFiles` (`packages/shared/src/files/definitionFromFiles.ts`) joins file contents with `+=`. A file that ends in a name token with no trailing newline fuses with the first token of the next file.

**Fix:** join with `"\n"`.

## Related

- [Architecture](./architecture.md)
- [Testing](./testing.md)
- [Conventions → Design workflow](./conventions.md#design-workflow)
