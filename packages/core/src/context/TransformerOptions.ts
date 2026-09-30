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
}

export const DEFAULT_TRANSFORMER_OPTIONS = Object.freeze<TransformerOptions>({
  relay: false,
  semanticNullability: false,
  operations: ["read", "write"],
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
  });
}
