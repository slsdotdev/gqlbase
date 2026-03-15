import { describe, it, expect } from "vitest";
import { FieldDefinitionNode, InputValueDefinitionNode, Kind } from "graphql";
import { InputValueNode } from "./InputValueNode.js";
import { ListTypeNode, NamedTypeNode, NonNullTypeNode } from "./TypeNode.js";
import { ValueNode } from "./ValueNode.js";
import { DirectiveNode } from "./DirectiveNode.js";

describe("InputValueNode", () => {
  it("creates node from values", () => {
    const node = InputValueNode.create("InputValueNode", "String", undefined, [
      DirectiveNode.create("exampleDirective"),
    ]);
    expect(node.name).toEqual("InputValueNode");
    expect(node.type).toBeInstanceOf(NamedTypeNode);
  });

  it("create NonNull node from values", () => {
    const node = InputValueNode.create("InputValueNode", NonNullTypeNode.create("String!"));
    expect(node.name).toEqual("InputValueNode");
    expect(node.type).toBeInstanceOf(NonNullTypeNode);
  });

  it("creates node from List type", () => {
    const node = InputValueNode.create("InputValueNode", ListTypeNode.create("String"));
    expect(node.name).toEqual("InputValueNode");
    expect(node.type).toBeInstanceOf(ListTypeNode);
  });

  it("creates node from Named definition", () => {
    const node = InputValueNode.create("InputValueNode", {
      kind: Kind.NAMED_TYPE,
      name: {
        kind: Kind.NAME,
        value: "String",
      },
    });

    expect(node).toBeInstanceOf(InputValueNode);
  });

  it("creates node from NonNull definition", () => {
    const node = InputValueNode.create("InputValueNode", {
      kind: Kind.NON_NULL_TYPE,
      type: {
        kind: Kind.NAMED_TYPE,
        name: {
          kind: Kind.NAME,
          value: "String",
        },
      },
    });

    expect(node).toBeInstanceOf(InputValueNode);
  });

  it("creates node from List definition", () => {
    const node = InputValueNode.create(
      "InputValueNode",
      {
        kind: Kind.LIST_TYPE,
        type: {
          kind: Kind.NAMED_TYPE,
          name: {
            kind: Kind.NAME,
            value: "String",
          },
        },
      },
      undefined,
      [
        {
          kind: Kind.DIRECTIVE,
          name: {
            kind: Kind.NAME,
            value: "exampleDirective",
          },
        },
      ]
    );

    expect(node).toBeInstanceOf(InputValueNode);
  });

  it("creates node from InputValue definition", () => {
    const node = InputValueNode.fromDefinition({
      kind: Kind.INPUT_VALUE_DEFINITION,
      name: {
        kind: Kind.NAME,
        value: "InputValueNode",
      },
      type: {
        kind: Kind.NAMED_TYPE,
        name: {
          kind: Kind.NAME,
          value: "String",
        },
      },
    } as const satisfies InputValueDefinitionNode);
    expect(node).toBeInstanceOf(InputValueNode);
    expect(node.name).toEqual("InputValueNode");
  });

  it("creates node from field value definition", () => {
    const node = InputValueNode.fromDefinition({
      kind: Kind.FIELD_DEFINITION,
      name: {
        kind: Kind.NAME,
        value: "InputValueNode",
      },
      type: {
        kind: Kind.NAMED_TYPE,
        name: {
          kind: Kind.NAME,
          value: "String",
        },
      },
    } as const satisfies FieldDefinitionNode);
    expect(node).toBeInstanceOf(InputValueNode);
    expect(node.name).toEqual("InputValueNode");
  });

  it("create list node from definition", () => {
    const node = InputValueNode.fromDefinition({
      kind: Kind.INPUT_VALUE_DEFINITION,
      name: {
        kind: Kind.NAME,
        value: "InputValueNode",
      },
      type: {
        kind: Kind.LIST_TYPE,
        type: {
          kind: Kind.NAMED_TYPE,
          name: {
            kind: Kind.NAME,
            value: "String",
          },
        },
      },
      directives: [
        {
          kind: Kind.DIRECTIVE,
          name: {
            kind: Kind.NAME,
            value: "exampleDirective",
          },
        },
      ],
    } as const satisfies InputValueDefinitionNode);
    expect(node).toBeInstanceOf(InputValueNode);
    expect(node.name).toEqual("InputValueNode");
  });

  it("serializes node to definition", () => {
    const node = InputValueNode.create(
      "InputValueNode",
      "String",
      ValueNode.string("description"),
      ["default"]
    );
    const definition = node.serialize();
    expect(definition.name.value).toEqual("InputValueNode");
    expect(definition.type.kind).toEqual(Kind.NAMED_TYPE);
  });
});
