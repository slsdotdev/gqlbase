import {
  DefinitionNode,
  FieldNode,
  InterfaceNode,
  ObjectNode,
  UnionNode,
} from "@gqlbase/core/definition";
import { isClientOnly, isReadOnly, isServerOnly, isWriteOnly } from "../UtilitiesPlugin/index.js";
import { isRelationField } from "../RelationsPlugin/index.js";

export interface ModelPluginOptions {
  operations: OperationType[];
}

export const ModelDirective = {
  MODEL: "model",
} as const;

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

export const DEFAULT_READ_OPERATIONS = ["get", "list"] as const satisfies OperationType[];
export const DEFAULT_WRITE_OPERATIONS = [
  "create",
  "update",
  "delete",
] as const satisfies OperationType[];

export const isModel = (definition: DefinitionNode): definition is ObjectNode => {
  return definition instanceof ObjectNode && definition.hasDirective(ModelDirective.MODEL);
};

export const isObjectLike = (
  type: DefinitionNode
): type is ObjectNode | InterfaceNode | UnionNode => {
  return type instanceof ObjectNode || type instanceof InterfaceNode || type instanceof UnionNode;
};

export const shouldSkipFieldFromMutationInput = (field: FieldNode): boolean => {
  return isReadOnly(field) || isServerOnly(field) || isClientOnly(field) || isRelationField(field);
};

export const shouldSkipFieldFromFilterInput = (field: FieldNode): boolean => {
  return isWriteOnly(field) || isServerOnly(field) || isClientOnly(field) || isRelationField(field);
};

export const shouldSkipFieldFromSortInput = (field: FieldNode): boolean => {
  return isServerOnly(field) || isClientOnly(field);
};
