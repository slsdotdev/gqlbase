import {
  BooleanValueNode,
  ConstValueNode,
  FloatValueNode,
  IntValueNode,
  Kind,
  StringValueNode,
  EnumValueNode,
  NullValueNode,
  ConstListValueNode,
  ConstObjectValueNode,
} from "graphql";

export type ValueType =
  | string
  | number
  | boolean
  | null
  | { [key: string]: ValueType }
  | ValueType[];

/**
 * TODO:
 * Maybe create an instance so we can call `getValue`
 * in order to parse arguments as JSON object;
 */

// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class ValueNode {
  static string(value: string): StringValueNode {
    return {
      kind: Kind.STRING,
      value,
    };
  }

  static boolean(value: boolean): BooleanValueNode {
    return {
      kind: Kind.BOOLEAN,
      value,
    };
  }

  static int(value: number): IntValueNode {
    return {
      kind: Kind.INT,
      value: value.toString(),
    };
  }

  static float(value: number): FloatValueNode {
    return {
      kind: Kind.FLOAT,
      value: value.toString(),
    };
  }

  static null(): NullValueNode {
    return {
      kind: Kind.NULL,
    };
  }

  static enum(value: string): EnumValueNode {
    return {
      kind: Kind.ENUM,
      value,
    };
  }

  static list(values: ConstValueNode[]): ConstListValueNode {
    return {
      kind: Kind.LIST,
      values,
    };
  }

  static object(values: Record<string, ConstValueNode>): ConstObjectValueNode {
    return {
      kind: Kind.OBJECT,
      fields: Object.entries(values).map(([key, value]) => ({
        kind: Kind.OBJECT_FIELD,
        name: {
          kind: Kind.NAME,
          value: key,
        },
        value,
      })),
    };
  }

  static fromValue(value: ValueType): ConstValueNode {
    switch (typeof value) {
      case "string":
        return ValueNode.string(value);
      case "number":
        return Number.isInteger(value) ? ValueNode.int(value) : ValueNode.float(value);
      case "boolean":
        return ValueNode.boolean(value);
      case "object":
        if (value === null) {
          return ValueNode.null();
        }
        if (Array.isArray(value)) {
          return ValueNode.list(value.map((v) => ValueNode.fromValue(v)));
        }
        return ValueNode.object(
          Object.entries(value).reduce(
            (acc, [key, v]) => {
              acc[`${key}`] = ValueNode.fromValue(v);
              return acc;
            },
            {} as Record<string, ConstValueNode>
          )
        );
    }
  }

  static getValue(node: ConstValueNode): ValueType {
    switch (node.kind) {
      case Kind.STRING:
        return node.value;
      case Kind.BOOLEAN:
        return node.value;
      case Kind.INT:
        return parseInt(node.value);
      case Kind.FLOAT:
        return parseFloat(node.value);
      case Kind.NULL:
        return null;
      case Kind.ENUM:
        return node.value;
      case Kind.LIST:
        return node.values.map((value) => ValueNode.getValue(value));
      case Kind.OBJECT:
        return node.fields.reduce(
          (acc, field) => {
            acc[field.name.value] = ValueNode.getValue(field.value);
            return acc;
          },
          {} as Record<string, ValueType>
        );
    }
  }
}
