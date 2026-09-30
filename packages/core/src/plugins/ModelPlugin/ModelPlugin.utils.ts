import { ModelOperation, type OperationType } from "../../context/index.js";
import { DefinitionNode, FieldNode, isObjectNode, ObjectNode } from "../../definition/index.js";
import {
  isClientOnly,
  isCreateOnly,
  isFilterOnly,
  isReadOnly,
  isServerOnly,
  isUpdateOnly,
} from "../UtilitiesPlugin/index.js";
import { isRelationField } from "../RelationsPlugin/index.js";

export const ModelDirective = {
  MODEL: "model",
} as const;

export { ModelOperation, type OperationType };

export const DEFAULT_READ_OPERATIONS = ["get", "list"] as const satisfies OperationType[];
export const DEFAULT_WRITE_OPERATIONS = [
  "create",
  "update",
  "delete",
] as const satisfies OperationType[];

export const isModel = (node: DefinitionNode): node is ObjectNode => {
  return isObjectNode(node) && node.hasDirective(ModelDirective.MODEL);
};

export const isPrimaryKeyField = (field: FieldNode): boolean => {
  return field.name === "id";
};

export const shouldSkipFieldFromInput = (field: FieldNode): boolean => {
  return isReadOnly(field) || isServerOnly(field) || isClientOnly(field) || isRelationField(field);
};

export const shouldSkipFieldFromFilterInput = (field: FieldNode): boolean => {
  return (
    shouldSkipFieldFromInput(field) ||
    ((isCreateOnly(field) || isUpdateOnly(field)) && !isFilterOnly(field))
  );
};

export const shouldSkipFieldFromCreateInput = (field: FieldNode): boolean => {
  return (
    shouldSkipFieldFromInput(field) ||
    ((isFilterOnly(field) || isUpdateOnly(field)) && !isCreateOnly(field))
  );
};

export const shouldSkipFieldFromUpdateInput = (field: FieldNode): boolean => {
  return (
    shouldSkipFieldFromInput(field) ||
    ((isFilterOnly(field) || isCreateOnly(field)) && !isUpdateOnly(field))
  );
};
