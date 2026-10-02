import { FieldNode } from "../../definition/index.js";
import {
  isClientOnly,
  isCreateOnly,
  isFilterOnly,
  isReadOnly,
  isServerOnly,
  isUpdateOnly,
  isWriteOnly,
} from "../UtilitiesPlugin/index.js";
import { isRelationField } from "../RelationsPlugin/RelationsPlugin.utils.js";

/**
 * Clients cannot filter on a value they cannot read, so `@writeOnly` fields are left out unless `@filterOnly` asks for them.
 */
export const shouldSkipFieldFromFilterInput = (field: FieldNode): boolean => {
  return (
    isReadOnly(field) ||
    isServerOnly(field) ||
    isClientOnly(field) ||
    isRelationField(field) ||
    ((isCreateOnly(field) || isUpdateOnly(field) || isWriteOnly(field)) && !isFilterOnly(field))
  );
};
