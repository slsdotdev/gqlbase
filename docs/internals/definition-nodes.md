# Definition nodes

_Audience: contributors and agents._

Plugins never touch graphql-js AST objects directly. Every definition is wrapped in a mutable class from `packages/core/src/definition/`, exported as `@gqlbase/core/definition`. Plugins read and change those wrappers in place. The document is converted back to graphql-js AST only to validate it (`validateSDL`) and to print it.

## Classes

| Class | Wraps | Notes |
|---|---|---|
| `DocumentNode` | `DocumentNode` | A `Map<name, DefinitionNode>` (`definitions`) keyed by type name. |
| `ObjectNode` | object type | Extends `WithInterfaceNode` (fields + interfaces + directives). |
| `InterfaceNode` | interface | Same base as `ObjectNode`. |
| `InputObjectNode` | input object | Holds `InputValueNode` fields. `addField` also accepts a `FieldDefinitionNode`, which is converted to an input value. |
| `EnumNode` / `EnumValueNode` | enum and its values | |
| `UnionNode` | union | `types` is a list of `NamedTypeNode`. |
| `ScalarNode` | scalar | |
| `DirectiveDefinitionNode` | directive definition | Stored in the same map as types, under the directive name. |
| `FieldNode` | field definition | Has `type`, `arguments` and directives. |
| `InputValueNode` | argument or input field | |
| `DirectiveNode` / `ArgumentNode` | directive usage and its arguments | `getArgumentsJSON<T>()` returns plain values. |
| `NamedTypeNode`, `ListTypeNode`, `NonNullTypeNode` | type references | Together they form the `TypeNode` union. `getTypeName()` unwraps to the named type. |
| `ValueNode` | static constructors for const values | `string`, `int`, `enum`, `list`, `object`, `fromValue`, `getValue`. |

The shared bases are `WithDescriptionNode`, `WithDirectivesNode` (`has`/`get`/`add`/`removeDirective`), `WithFieldsNode` (`has`/`get`/`add`/`removeField`, `getFields`) and `WithInterfaceNode`.

`DefinitionNode` (in `packages/core/src/definition/utils.ts`) is the union of what the document map holds: object, interface, input object, enum, union, scalar and directive definition.

Every class has these three methods:
- `static create(...)` builds a node from scratch.
- `static fromDefinition(ast)` wraps a graphql-js AST node.
- `serialize()` converts the node back to a graphql-js AST node.

## `DocumentNode`

`packages/core/src/definition/DocumentNode.ts`

- **Construction.** `fromSource(sdl)` parses the SDL, and `fromDefinition(ast)` wraps an existing graphql-js document. Both add every definition first and apply type extensions (`extend type …`) after, so the order in which source files were concatenated does not matter.
- **Merging.** `merge(...docs)` returns a new document holding the same node instances, and throws `InvalidDefinitionError` on a duplicate name. The context uses it to combine `base` with the user's source. `clone(doc)` makes a deep copy through a serialize/re-parse round trip.
- **Lookups:**
  - `hasNode`, `getNode`, `getNodeOrThrow`;
  - `getOrCreateNode(name, node)`, which is idempotent;
  - `getQueryNode()` and `getMutationNode()`, which create an empty root type if none exists.
- **Mutation.** `addNode` throws if the name already exists; `removeNode` does not throw. Both return `this`, so calls chain.
- **Output.** `validate()` runs graphql-js `validateSDL`, and `print()` prints the document back to SDL.

## Mutation rules

- Adding a field or directive that already exists throws. Check with `hasField` or `hasDirective` first, or use `getOrCreateNode`.
- `removeField` and `removeDirective` never throw.
- Nodes are shared by reference. `merge` does not copy, so a node that a plugin adds to `context.base` in `init()` is the same instance that ends up in the working document.

## Helpers

These are type guards and predicates in `packages/core/src/definition/utils.ts`:

| Helper | Meaning |
|---|---|
| `isObjectNode`, `isInterfaceNode`, `isUnionNode`, `isEnumNode`, `isScalarNode`, `isInputObjectNode`, … | Kind checks. |
| `isObjectLike` | Object, interface or union. |
| `isOperationNode` | `Query`, `Mutation` or `Subscription`. |
| `isListTypeNode(type)` | A list, possibly wrapped in non-null. |
| `isNullableTypeNode(type, level)` | Nullability at a list depth. |

Directive predicates live next to the plugin that owns the directive:
- `isModel`: `packages/plugins/src/base/ModelPlugin/ModelPlugin.utils.ts`.
- `isServerOnly`, `isClientOnly`, `isReadOnly`, …: `packages/plugins/src/base/UtilitiesPlugin/UtilitiesPlugin.utils.ts`.
- `isSemanticNullable`: `packages/plugins/src/base/RfcFeaturesPlugin/RfcFeaturesPlugin.utils.ts`.

Built-in scalar names (`ID`, `String`, `Int`, `Float`, `Boolean`) are in `packages/shared/src/definition`.

## Related

- [Architecture](./architecture.md)
- [Plugin API](./plugin-api.md)
- [Known gaps](./known-gaps.md)
