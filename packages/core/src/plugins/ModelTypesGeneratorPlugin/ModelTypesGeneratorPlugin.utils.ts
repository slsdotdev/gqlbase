import type { ITransformerContext } from "../../context/index.js";
import {
  FieldNode,
  InterfaceNode,
  isDirectiveDefinitionNode,
  ObjectNode,
} from "../../definition/index.js";
import { isInternal } from "../InternalUtilsPlugin/index.js";
import { collectReachableDefinitions } from "../SchemaGeneratorPlugin/SchemaGeneratorPlugin.utils.js";

export const SCHEMA_TYPES_FILE = "schema.types.ts";

export const getBuildinScalarTypeKeyword = (typeName: string): string => {
  switch (typeName) {
    case "ID":
    case "String":
      return "string";
    case "Int":
    case "Float":
      return "number";
    case "Boolean":
      return "boolean";
    default:
      throw new Error(`Unsupported build-in scalar type: ${typeName}`);
  }
};

/**
 * Whether a field is in the schema types and the Zod row schemas: every field but gqlbase's internal ones. `@serverOnly` and `@writeOnly`
 * fields and relation keys are kept, since server code reads them; the client schema leaves them out (see `isPublicSchemaField`).
 *
 * @param field The field to check.
 * @param parent The object or interface that declares the field.
 */
export const isSchemaTypeField = (field: FieldNode, parent: ObjectNode | InterfaceNode) => {
  return !isInternal(parent) && !isInternal(field);
};

/**
 * Collects the names of the definitions the schema types declare: every non-internal definition the source declares, and everything
 * reachable from those and from the operation types through `isSchemaTypeField` fields. `@serverOnly` types and definitions only hidden
 * fields reach are included; definitions a plugin adds that nothing uses (unused scalars, filters of unused scalars) are not.
 */
export const collectSchemaTypeDefinitions = (context: ITransformerContext): Set<string> => {
  const roots = [...context.sourceDefinitions].filter((name) => {
    const node = context.document.getNode(name);
    return node && !isDirectiveDefinitionNode(node);
  });

  return collectReachableDefinitions(context, isSchemaTypeField, undefined, roots);
};
