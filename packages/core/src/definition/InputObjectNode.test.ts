import { describe, it, expect } from "vitest";
import {
  FieldDefinitionNode,
  InputObjectTypeDefinitionNode,
  InputObjectTypeExtensionNode,
  InputValueDefinitionNode,
  Kind,
  ObjectTypeDefinitionNode,
} from "graphql";
import { InputObjectNode } from "./InputObjectNode";
import { InputValueNode } from "./InputValueNode";

describe("InputObjectNode", () => {
  it("creates node from values", () => {
    const node = InputObjectNode.create("InputObject", [InputValueNode.create("id", "ID")]);
    expect(node.name).toEqual("InputObject");
    expect(node.fields).toBeInstanceOf(Array);
  });

  it("creates node from Input type definition", () => {
    const node = InputObjectNode.fromDefinition({
      kind: Kind.INPUT_OBJECT_TYPE_DEFINITION,
      name: {
        kind: Kind.NAME,
        value: "InputObject",
      },
      fields: [
        {
          kind: Kind.INPUT_VALUE_DEFINITION,
          name: {
            kind: Kind.NAME,
            value: "id",
          },
          type: {
            kind: Kind.NAMED_TYPE,
            name: {
              kind: Kind.NAME,
              value: "ID",
            },
          },
        },
        {
          kind: Kind.INPUT_VALUE_DEFINITION,
          name: {
            kind: Kind.NAME,
            value: "name",
          },
          type: {
            kind: Kind.NAMED_TYPE,
            name: {
              kind: Kind.NAME,
              value: "String",
            },
          },
        },
      ],
      directives: [
        {
          kind: Kind.DIRECTIVE,
          name: {
            kind: Kind.NAME,
            value: "directive1",
          },
        },
      ],
    } as const satisfies InputObjectTypeDefinitionNode);

    expect(node).toBeInstanceOf(InputObjectNode);
    expect(node.name).toEqual("InputObject");
    expect(node.fields).toBeInstanceOf(Array);
    expect(node.fields?.length).toEqual(2);
  });

  it("creates node from Object type definition", () => {
    const node = InputObjectNode.fromDefinition({
      kind: Kind.OBJECT_TYPE_DEFINITION,
      name: {
        kind: Kind.NAME,
        value: "InputObject",
      },
      fields: [
        {
          kind: Kind.FIELD_DEFINITION,
          name: {
            kind: Kind.NAME,
            value: "id",
          },
          type: {
            kind: Kind.NAMED_TYPE,
            name: {
              kind: Kind.NAME,
              value: "ID",
            },
          },
        },
      ],
    } as const satisfies ObjectTypeDefinitionNode);

    expect(node).toBeInstanceOf(InputObjectNode);
    expect(node.fields?.length).toEqual(1);
  });

  it("serializes node to definition", () => {
    const node = InputObjectNode.create("InputObject", [
      InputValueNode.create("id", "ID"),
      InputValueNode.create("name", "String"),
    ]);
    const definition = node.serialize();
    expect(definition).toBeInstanceOf(Object);
    expect(definition.kind).toEqual(Kind.INPUT_OBJECT_TYPE_DEFINITION);
    expect(definition.name.value).toEqual("InputObject");
    expect(definition.fields).toBeInstanceOf(Array);
  });

  it("checks if node has field", () => {
    const node = InputObjectNode.create("InputObject", [
      InputValueNode.create("id", "ID"),
      InputValueNode.create("name", "String"),
    ]);
    expect(node.hasField("id")).toEqual(true);
    expect(node.hasField("name")).toEqual(true);
    expect(node.hasField("age")).toEqual(false);
  });

  it("adds field to node", () => {
    const node = InputObjectNode.create("InputObject");
    node
      .addField(InputValueNode.create("id", "ID"))
      .addField({
        kind: Kind.INPUT_VALUE_DEFINITION,
        name: {
          kind: Kind.NAME,
          value: "name",
        },
        type: {
          kind: Kind.NAMED_TYPE,
          name: {
            kind: Kind.NAME,
            value: "String",
          },
        },
      } as const satisfies InputValueDefinitionNode)
      .addField({
        kind: Kind.FIELD_DEFINITION,
        name: {
          kind: Kind.NAME,
          value: "age",
        },
        type: {
          kind: Kind.NAMED_TYPE,
          name: {
            kind: Kind.NAME,
            value: "Int",
          },
        },
      } as const satisfies FieldDefinitionNode);

    expect(node.fields).toHaveLength(3);
  });

  it("throws error when adding duplicate field", () => {
    const node = InputObjectNode.create("InputObject", [InputValueNode.create("id", "ID")]);
    expect(() => {
      node.addField(InputValueNode.create("id", "ID"));
    }).toThrow("Field id already exists on type InputObject");
  });
  it("removes field from node", () => {
    const node = InputObjectNode.create("InputObject", [
      InputValueNode.create("id", "ID"),
      InputValueNode.create("name", "String"),
    ]);
    expect(node.fields).toHaveLength(2);
    node.removeField("id");
    expect(node.fields).toHaveLength(1);
  });

  it("extends node with definition", () => {
    const node = InputObjectNode.create("InputObject", [InputValueNode.create("id", "ID")]);
    const definition = {
      kind: Kind.INPUT_OBJECT_TYPE_EXTENSION,
      name: {
        kind: Kind.NAME,
        value: "InputObject",
      },
      fields: [
        {
          kind: Kind.INPUT_VALUE_DEFINITION,
          name: {
            kind: Kind.NAME,
            value: "name",
          },
          type: {
            kind: Kind.NAMED_TYPE,
            name: {
              kind: Kind.NAME,
              value: "String",
            },
          },
        },
      ],
      directives: [
        {
          kind: Kind.DIRECTIVE,
          name: {
            kind: Kind.NAME,
            value: "directive1",
          },
        },
      ],
    } as const satisfies InputObjectTypeExtensionNode;

    node.extend(definition);
    expect(node.fields).toHaveLength(2);
  });
});
