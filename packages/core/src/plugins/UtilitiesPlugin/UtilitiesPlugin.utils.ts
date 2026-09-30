import { FieldNode, InputValueNode } from "../../definition/index.js";

export const UtilityDirective = {
  /** @serverOnly Marks a field as server-only, meaning it should only be resolved on the server and not exposed to the client. The field will be removed from the final schema */
  SERVER_ONLY: "serverOnly",

  /** @clientOnly Marks a field as client-only, meaning it will be resolved at runtime. This field does not get added to inputs. */
  CLIENT_ONLY: "clientOnly",

  /** @readOnly Marks a field as read-only, meaning it will be included in the schema but cannot be modified by the user. This field does not get added to inputs. */
  READ_ONLY: "readOnly",

  /** @writeOnly Marks a field as write-only, meaning it will only be available in inputs. */
  WRITE_ONLY: "writeOnly",

  /** @filterOnly Marks a field as filter-only, meaning it will only be available in the filter input */
  FILTER_ONLY: "filterOnly",

  /** @createOnly Marks a field as create-only, meaning it will only be available in the create input */
  CREATE_ONLY: "createOnly",

  /** @updateOnly Marks a field as update-only, meaning it will only be available in the update input */
  UPDATE_ONLY: "updateOnly",

  /**
   * @constraint Adds validation constraints to a field. Mainly used by other plugins to add validation rules to fields.
   */
  CONSTRAINT: "constraint",
} as const;

export interface FieldContraints {
  min?: number;
  max?: number;
  pattern?: string;
}

export const isReadOnly = (node: FieldNode): boolean => {
  return node.hasDirective(UtilityDirective.READ_ONLY);
};

export const isWriteOnly = (node: FieldNode): boolean => {
  return node.hasDirective(UtilityDirective.WRITE_ONLY);
};

export const isServerOnly = (node: FieldNode): boolean => {
  return node.hasDirective(UtilityDirective.SERVER_ONLY);
};

export const isClientOnly = (node: FieldNode): boolean => {
  return node.hasDirective(UtilityDirective.CLIENT_ONLY);
};

export const isFilterOnly = (node: FieldNode): boolean => {
  return node.hasDirective(UtilityDirective.FILTER_ONLY);
};

export const isCreateOnly = (node: FieldNode): boolean => {
  return node.hasDirective(UtilityDirective.CREATE_ONLY);
};

export const isUpdateOnly = (node: FieldNode): boolean => {
  return node.hasDirective(UtilityDirective.UPDATE_ONLY);
};

export const hasConstraints = (node: FieldNode | InputValueNode): boolean => {
  return node.hasDirective(UtilityDirective.CONSTRAINT);
};

export const parseConstraints = (node: FieldNode | InputValueNode): FieldContraints => {
  if (!hasConstraints(node)) {
    return {};
  }

  const directive = node.getDirective(UtilityDirective.CONSTRAINT);
  const args = directive?.getArgumentsJSON();

  return {
    min:
      typeof args?.min === "number"
        ? node.type.getTypeName() === "Float"
          ? args.min
          : Math.floor(args.min)
        : undefined,
    max:
      typeof args?.max === "number"
        ? node.type.getTypeName() === "Float"
          ? args.max
          : Math.floor(args.max)
        : undefined,
    pattern: typeof args?.pattern === "string" ? args.pattern : undefined,
  };
};
