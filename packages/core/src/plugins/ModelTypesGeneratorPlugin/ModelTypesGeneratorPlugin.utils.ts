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
