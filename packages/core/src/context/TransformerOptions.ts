export const ModelOperation = {
  /** Shorthand for read operations (`get`, `list`) */
  READ: "read",

  /** Shorthand for write operations (`create`, `update`, `delete`) */
  WRITE: "write",

  // Query operations
  GET: "get",
  LIST: "list",

  // Mutation operations
  CREATE: "create",
  UPDATE: "update",
  UPSERT: "upsert",
  DELETE: "delete",

  // TBD
  // SYNC: "sync",
  // SUBSCRIBE: "subscribe",
} as const;

export type OperationType = (typeof ModelOperation)[keyof typeof ModelOperation];

/**
 * One tenancy scope: the claims a scoped model carries. `claims` maps a claim field name to its scalar type; `null` is a
 * scope without claims (a global model).
 */

export interface TenancyScopeOptions {
  /** Applies the scope to every stored model without `@scope`. At most one scope is the default. */
  default?: boolean;

  /** Claim field name → scalar type name, for example `{ workspaceId: "ID" }`. */
  claims: Record<string, string> | null;
}

/**
 * One data source: a store that holds models. `type` names what the store is (`"dsqlbase"`, `"service"`); core never
 * reads it, and each capability plugin emits only the models of the types it handles.
 */

export interface DataSourceOptions {
  /** The store kind, matched by capability plugins. A type no plugin handles is valid: nothing is generated for it. */
  type: string;

  /** Holds every stored model without `@dataSource`. At most one source is the default. */
  default?: boolean;
}

/**
 * Options that shape the generated schema. They are frozen onto `context.options`, so every plugin reads the same values instead of probing the document.
 */

export interface TransformerOptions {
  /**
   * Adds the `Node` interface to models and turns list relations into Relay connections.
   * @default false
   */
  relay: boolean;

  /**
   * Enables the `@semanticNonNull` directive. Generated fields that are null only on error use it instead of plain non-null.
   * @default false
   */
  semanticNullability: boolean;

  /**
   * Operations generated for a `@model` that does not list its own.
   * @default ["read", "write"]
   */
  operations: OperationType[];

  /**
   * Tenancy scopes by name. A scoped model gets each claim as a `@serverOnly` field, which the ORM fills from the caller's
   * identity. Registers `TenancyPlugin` when it declares any scope.
   * @default {}
   */
  tenancy: Record<string, TenancyScopeOptions>;

  /**
   * Data sources by name. A stored model is in the default source, or in the one its `@dataSource` names. Registers
   * `DataSourcesPlugin` when it declares any source; without one, every stored model is handled by every capability
   * plugin.
   * @default {}
   */
  dataSources: Record<string, DataSourceOptions>;
}

export const DEFAULT_TRANSFORMER_OPTIONS = Object.freeze<TransformerOptions>({
  relay: false,
  semanticNullability: false,
  operations: ["read", "write"],
  tenancy: {},
  dataSources: {},
});

export function resolveTransformerOptions(
  options: Partial<TransformerOptions> = {}
): Readonly<TransformerOptions> {
  return Object.freeze({
    relay: options.relay ?? DEFAULT_TRANSFORMER_OPTIONS.relay,
    semanticNullability:
      options.semanticNullability ?? DEFAULT_TRANSFORMER_OPTIONS.semanticNullability,
    operations: Object.freeze([
      ...(options.operations ?? DEFAULT_TRANSFORMER_OPTIONS.operations),
    ]) as OperationType[],
    tenancy: Object.freeze({ ...(options.tenancy ?? DEFAULT_TRANSFORMER_OPTIONS.tenancy) }),
    dataSources: Object.freeze({
      ...(options.dataSources ?? DEFAULT_TRANSFORMER_OPTIONS.dataSources),
    }),
  });
}
