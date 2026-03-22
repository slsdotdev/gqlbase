import { beforeAll, describe, expect, it } from "vitest";
import { TransformerContext } from "@gqlbase/core";
import {
  DocumentNode,
  FieldNode,
  InterfaceNode,
  NonNullTypeNode,
  ObjectNode,
} from "@gqlbase/core/definition";
import { NodeInterfacePlugin } from "./NodeInterfacePlugin.js";

describe("NodeInterfacePlugin", () => {
  let plugin: NodeInterfacePlugin;
  let context: TransformerContext;

  beforeAll(() => {
    context = new TransformerContext();
    plugin = new NodeInterfacePlugin(context);
    context.registerPlugin(plugin);
  });

  describe("match", () => {
    it("matches types that implement Node", () => {
      context.finishWork();
      context.startWork(
        DocumentNode.fromSource(/* GraphQL */ `
          type User implements Node {
            id: ID!
          }
        `)
      );

      const user = context.document.getNode("User") as ObjectNode;
      expect(plugin.match(user)).toBe(true);
    });

    it("matches types with @model directive", () => {
      context.finishWork();
      context.startWork(
        DocumentNode.fromSource(/* GraphQL */ `
          type User @model {
            name: String!
          }

          type Query {
            me: User
          }
        `)
      );

      const user = context.document.getNode("User") as ObjectNode;
      expect(plugin.match(user)).toBe(true);
    });

    it("does not match types without Node interface or @model", () => {
      context.finishWork();
      context.startWork(
        DocumentNode.fromSource(/* GraphQL */ `
          type Post {
            title: String!
          }
        `)
      );

      const post = context.document.getNode("Post") as ObjectNode;
      expect(plugin.match(post)).toBe(false);
    });

    it("does not match interface definitions", () => {
      context.finishWork();
      context.startWork(
        DocumentNode.fromSource(/* GraphQL */ `
          interface Timestamped {
            createdAt: String!
          }
        `)
      );

      const timestamped = context.document.getNode("Timestamped");
      expect(timestamped).toBeDefined();
      expect(plugin.match(timestamped as InterfaceNode)).toBe(false);
    });
  });

  describe("before", () => {
    it("creates Node interface with id: ID! field", () => {
      context.finishWork();
      context.startWork(
        DocumentNode.fromSource(/* GraphQL */ `
          type User implements Node {
            id: ID!
          }
        `)
      );

      plugin.before();

      const iface = context.document.getNode("Node") as InterfaceNode;
      expect(iface).toBeInstanceOf(InterfaceNode);

      const idField = iface.getField("id");
      expect(idField).toBeInstanceOf(FieldNode);
      expect(idField?.type).toBeInstanceOf(NonNullTypeNode);
      expect(idField?.type.getTypeName()).toBe("ID");
    });

    it("creates Query.node field with id argument", () => {
      context.finishWork();
      context.startWork(
        DocumentNode.fromSource(/* GraphQL */ `
          type User implements Node {
            id: ID!
          }
        `)
      );

      plugin.before();

      const queryNode = context.document.getQueryNode();
      expect(queryNode).toBeInstanceOf(ObjectNode);
      expect(queryNode.hasField("node")).toBe(true);

      const nodeField = queryNode.getField("node");
      expect(nodeField).toBeDefined();
      expect(nodeField?.type.getTypeName()).toBe("Node");
    });

    it("throws when user declares Node as a type instead of interface", () => {
      context.finishWork();
      context.startWork(
        DocumentNode.fromSource(/* GraphQL */ `
          type Node {
            id: ID!
          }
        `)
      );

      expect(() => plugin.before()).toThrow("Node type must be an interface");
    });

    it("accepts user-defined Node interface that is valid", () => {
      context.finishWork();
      context.startWork(
        DocumentNode.fromSource(/* GraphQL */ `
          interface Node {
            id: ID!
          }

          type User implements Node {
            id: ID!
          }
        `)
      );

      plugin.before();

      const iface = context.document.getNode("Node") as InterfaceNode;
      expect(iface).toBeInstanceOf(InterfaceNode);
      expect(iface.getField("id")).toBeDefined();
    });

    it("adds id field to user-defined Node interface if missing", () => {
      context.finishWork();
      context.startWork(
        DocumentNode.fromSource(/* GraphQL */ `
          interface Node {
            createdAt: String!
          }

          type User implements Node {
            id: ID!
            createdAt: String!
          }
        `)
      );

      plugin.before();

      const iface = context.document.getNode("Node") as InterfaceNode;
      expect(iface.getField("id")).toBeDefined();
      expect(iface.getField("id")?.type.getTypeName()).toBe("ID");
    });

    it("does not duplicate id field if already present", () => {
      context.finishWork();
      context.startWork(
        DocumentNode.fromSource(/* GraphQL */ `
          interface Node {
            id: ID!
          }

          type User implements Node {
            id: ID!
          }
        `)
      );

      plugin.before();

      const iface = context.document.getNode("Node") as InterfaceNode;
      const idFields = iface.fields?.filter((f) => f.name === "id");
      expect(idFields).toHaveLength(1);
    });

    it("does not duplicate Query.node field if already present", () => {
      context.finishWork();
      context.startWork(
        DocumentNode.fromSource(/* GraphQL */ `
          type User implements Node {
            id: ID!
          }
        `)
      );

      plugin.before();
      plugin.before();

      const queryNode = context.document.getQueryNode();
      const nodeFields = queryNode.fields?.filter((f) => f.name === "node");
      expect(nodeFields).toHaveLength(1);
    });
  });

  describe("execute", () => {
    it("adds Node interface to @model types", () => {
      context.finishWork();
      context.startWork(
        DocumentNode.fromSource(/* GraphQL */ `
          type User @model {
            name: String!
          }

          type Query {
            me: User
          }
        `)
      );

      plugin.before();

      const user = context.document.getNode("User") as ObjectNode;
      plugin.execute(user);

      expect(user.hasInterface("Node")).toBe(true);
    });

    it("adds id field to types implementing Node that lack it", () => {
      context.finishWork();
      context.startWork(
        DocumentNode.fromSource(/* GraphQL */ `
          type User implements Node {
            name: String!
          }
        `)
      );

      plugin.before();

      const user = context.document.getNode("User") as ObjectNode;
      plugin.execute(user);

      expect(user.hasField("id")).toBe(true);
      expect(user.getField("id")?.type.getTypeName()).toBe("ID");
    });

    it("does not duplicate id field if type already has it", () => {
      context.finishWork();
      context.startWork(
        DocumentNode.fromSource(/* GraphQL */ `
          type User implements Node {
            id: ID!
            name: String!
          }
        `)
      );

      plugin.before();

      const user = context.document.getNode("User") as ObjectNode;
      plugin.execute(user);

      const idFields = user.fields?.filter((f) => f.name === "id");
      expect(idFields).toHaveLength(1);
    });

    it("throws if type has id field with wrong type", () => {
      context.finishWork();
      context.startWork(
        DocumentNode.fromSource(/* GraphQL */ `
          type User implements Node {
            id: String!
            name: String!
          }
        `)
      );

      plugin.before();

      const user = context.document.getNode("User") as ObjectNode;
      expect(() => plugin.execute(user)).toThrow(/different type/);
    });

    it("preserves existing interfaces when adding Node", () => {
      context.finishWork();
      context.startWork(
        DocumentNode.fromSource(/* GraphQL */ `
          interface Timestamped {
            createdAt: String!
          }

          type User implements Timestamped @model {
            createdAt: String!
            name: String!
          }

          type Query {
            me: User
          }
        `)
      );

      plugin.before();

      const user = context.document.getNode("User") as ObjectNode;
      plugin.execute(user);

      expect(user.hasInterface("Node")).toBe(true);
      expect(user.hasInterface("Timestamped")).toBe(true);
    });

    it("does not add Node interface to types that already implement it", () => {
      context.finishWork();
      context.startWork(
        DocumentNode.fromSource(/* GraphQL */ `
          type User implements Node {
            id: ID!
          }
        `)
      );

      plugin.before();

      const user = context.document.getNode("User") as ObjectNode;
      plugin.execute(user);

      expect(user.hasInterface("Node")).toBe(true);
    });
  });

  describe("after", () => {
    it("strips extra fields from Node interface, keeping only id", () => {
      context.finishWork();
      context.startWork(
        DocumentNode.fromSource(/* GraphQL */ `
          interface Node {
            id: ID!
            createdAt: String!
          }

          type User implements Node {
            id: ID!
            createdAt: String!
          }
        `)
      );

      plugin.before();
      plugin.after();

      const iface = context.document.getNode("Node") as InterfaceNode;
      expect(iface.getField("id")).toBeDefined();
      expect(iface.getField("createdAt")).toBeUndefined();
    });

    it("keeps id field untouched in after phase", () => {
      context.finishWork();
      context.startWork(
        DocumentNode.fromSource(/* GraphQL */ `
          type User implements Node {
            id: ID!
          }
        `)
      );

      plugin.before();
      plugin.after();

      const iface = context.document.getNode("Node") as InterfaceNode;
      expect(iface.getField("id")).toBeDefined();
      expect(iface.fields).toHaveLength(1);
    });
  });
});
