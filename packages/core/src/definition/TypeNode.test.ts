import { describe, it, expect } from "vitest";
import { NamedTypeNode as INamedTypeNode, ListTypeNode as IListTypeNode, Kind } from "graphql";
import { ListTypeNode, NamedTypeNode, NonNullTypeNode } from "./TypeNode.js";

describe("TypeNode", () => {
  describe("NamedTypeNode", () => {
    it("creates node", () => {
      const node = NamedTypeNode.create("String");
      expect(node).toBeInstanceOf(NamedTypeNode);
      expect(node.getTypeName()).toEqual("String");
    });

    it("creates node from definition", () => {
      const node = NamedTypeNode.fromDefinition({
        kind: Kind.NAMED_TYPE,
        name: {
          kind: Kind.NAME,
          value: "String",
        },
      } satisfies INamedTypeNode);

      expect(node).toBeInstanceOf(NamedTypeNode);
    });

    it("serializes node", () => {
      const node = NamedTypeNode.create("String");
      expect(node.serialize()).toEqual({
        kind: Kind.NAMED_TYPE,
        name: {
          kind: Kind.NAME,
          value: "String",
        },
      });
    });
  });

  describe("ListTypeNode", () => {
    it("creates node from string value", () => {
      const node = ListTypeNode.create("String");

      expect(node).toBeInstanceOf(ListTypeNode);
      expect(node.getTypeName()).toEqual("String");
    });

    it("creates node from NamedTypeNode value", () => {
      const node = ListTypeNode.create(NamedTypeNode.create("String"));

      expect(node).toBeInstanceOf(ListTypeNode);
      expect(node.getTypeName()).toEqual("String");
    });

    it("creates node from named type definition", () => {
      const node = ListTypeNode.fromDefinition({
        kind: Kind.LIST_TYPE,
        type: {
          kind: Kind.NAMED_TYPE,
          name: {
            kind: Kind.NAME,
            value: "String",
          },
        },
      } satisfies IListTypeNode);

      expect(node).toBeInstanceOf(ListTypeNode);
    });
    it("creates node from non null type definition", () => {
      const node = ListTypeNode.fromDefinition({
        kind: Kind.LIST_TYPE,
        type: {
          kind: Kind.NON_NULL_TYPE,
          type: {
            kind: Kind.NAMED_TYPE,
            name: {
              kind: Kind.NAME,
              value: "String",
            },
          },
        },
      } satisfies IListTypeNode);

      expect(node).toBeInstanceOf(ListTypeNode);
    });
    it("creates node from list type definition", () => {
      const node = ListTypeNode.fromDefinition({
        kind: Kind.LIST_TYPE,
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
      } satisfies IListTypeNode);

      expect(node).toBeInstanceOf(ListTypeNode);
    });

    it("serializes node", () => {
      const node = ListTypeNode.create("String");
      expect(node.serialize()).toEqual({
        kind: Kind.LIST_TYPE,
        type: {
          kind: Kind.NAMED_TYPE,
          name: {
            kind: Kind.NAME,
            value: "String",
          },
        },
      });
    });
  });

  describe("NonNullTypeNode", () => {
    it("creates node from string value", () => {
      const node = NonNullTypeNode.create("String");

      expect(node).toBeInstanceOf(NonNullTypeNode);
      expect(node.getTypeName()).toEqual("String");
    });
    it("creates node from NamedTypeNode value", () => {
      const node = NonNullTypeNode.create(NamedTypeNode.create("String"));

      expect(node).toBeInstanceOf(NonNullTypeNode);
      expect(node.getTypeName()).toEqual("String");
    });

    it("creates node from array value", () => {
      const node = NonNullTypeNode.create(["String"]);

      expect(node).toBeInstanceOf(NonNullTypeNode);
      expect(node.getTypeName()).toEqual("String");
    });

    it("creates node from ListTypeNode value", () => {
      const node = NonNullTypeNode.create(ListTypeNode.create("String"));

      expect(node).toBeInstanceOf(NonNullTypeNode);
      expect(node.getTypeName()).toEqual("String");
    });

    it("creates node from named definition", () => {
      const node = NonNullTypeNode.fromDefinition({
        kind: Kind.NON_NULL_TYPE,
        type: {
          kind: Kind.NAMED_TYPE,
          name: {
            kind: Kind.NAME,
            value: "String",
          },
        },
      });

      expect(node).toBeInstanceOf(NonNullTypeNode);
      expect(node.type).toBeInstanceOf(NamedTypeNode);
    });

    it("creates node from list definition", () => {
      const node = NonNullTypeNode.fromDefinition({
        kind: Kind.NON_NULL_TYPE,
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
      });

      expect(node).toBeInstanceOf(NonNullTypeNode);
      expect(node.type).toBeInstanceOf(ListTypeNode);
    });

    it("serializes node", () => {
      const node = NonNullTypeNode.create("String");
      expect(node.serialize()).toEqual({
        kind: Kind.NON_NULL_TYPE,
        type: {
          kind: Kind.NAMED_TYPE,
          name: {
            kind: Kind.NAME,
            value: "String",
          },
        },
      });
    });
  });
});
