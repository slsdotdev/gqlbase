import { beforeAll, describe, expect, it } from "vitest";
import { TransformerContext } from "@gqlbase/core";
import { DocumentNode, EnumNode, InterfaceNode, ObjectNode } from "@gqlbase/core/definition";
import { InterfaceUtilsPlugin } from "./InterfaceUtilsPlugin.js";

describe("InterfaceUtilsPlugin", () => {
  let context: TransformerContext;
  let plugin: InterfaceUtilsPlugin;

  beforeAll(() => {
    context = new TransformerContext();
    plugin = new InterfaceUtilsPlugin(context);
    context.registerPlugin(plugin);
  });

  describe("match", () => {
    it("matches object types", () => {
      context.finishWork();
      context.startWork(
        DocumentNode.fromSource(/* GraphQL */ `
          type User {
            id: ID!
            name: String!
          }
        `)
      );

      const user = context.document.getNode("User") as ObjectNode;
      expect(plugin.match(user)).toBe(true);
    });

    it("matches interface types", () => {
      context.finishWork();
      context.startWork(
        DocumentNode.fromSource(/* GraphQL */ `
          interface Node {
            id: ID!
          }
        `)
      );

      const node = context.document.getNode("Node") as InterfaceNode;
      expect(plugin.match(node)).toBe(true);
    });

    it("does not match other definition types", () => {
      context.finishWork();
      context.startWork(
        DocumentNode.fromSource(/* GraphQL */ `
          enum Status {
            ACTIVE
            INACTIVE
          }

          type Query {
            status: Status
          }
        `)
      );

      const status = context.document.getNode("Status") as EnumNode;
      expect(plugin.match(status)).toBe(false);
    });
  });

  describe("normalize", () => {
    it("adds missing interface fields to implementing object", () => {
      context.finishWork();
      context.startWork(
        DocumentNode.fromSource(/* GraphQL */ `
          interface Timestamped {
            createdAt: DateTime!
            updatedAt: DateTime!
          }

          type User implements Timestamped {
            id: ID!
            name: String!
          }
        `)
      );

      const user = context.document.getNode("User") as ObjectNode;
      plugin.normalize(user);

      expect(user.hasField("createdAt")).toBe(true);
      expect(user.hasField("updatedAt")).toBe(true);
      expect(user.getField("createdAt")?.type.getTypeName()).toBe("DateTime");
      expect(user.getField("updatedAt")?.type.getTypeName()).toBe("DateTime");
    });

    it("adds missing interface fields to implementing interface", () => {
      context.finishWork();
      context.startWork(
        DocumentNode.fromSource(/* GraphQL */ `
          interface Node {
            id: ID!
          }

          interface Timestamped {
            createdAt: DateTime!
            updatedAt: DateTime!
          }

          interface User implements Node & Timestamped {
            id: ID!
            name: String!
          }
        `)
      );

      const user = context.document.getNode("User") as InterfaceNode;
      plugin.normalize(user);

      expect(user.hasField("createdAt")).toBe(true);
      expect(user.hasField("updatedAt")).toBe(true);
    });

    it("does not duplicate fields already present on implementor", () => {
      context.finishWork();
      context.startWork(
        DocumentNode.fromSource(/* GraphQL */ `
          interface Node {
            id: ID!
          }

          type User implements Node {
            id: ID!
            name: String!
          }
        `)
      );

      const user = context.document.getNode("User") as ObjectNode;
      const fieldCountBefore = user.fields?.length;
      plugin.normalize(user);

      expect(user.fields?.length).toBe(fieldCountBefore);
    });

    it("handles multiple interface implementations", () => {
      context.finishWork();
      context.startWork(
        DocumentNode.fromSource(/* GraphQL */ `
          interface Node {
            id: ID!
          }

          interface Timestamped {
            createdAt: DateTime!
            updatedAt: DateTime!
          }

          type Post implements Node & Timestamped {
            id: ID!
            title: String!
          }
        `)
      );

      const post = context.document.getNode("Post") as ObjectNode;
      plugin.normalize(post);

      expect(post.hasField("id")).toBe(true);
      expect(post.hasField("createdAt")).toBe(true);
      expect(post.hasField("updatedAt")).toBe(true);
      expect(post.hasField("title")).toBe(true);
    });

    it("adds transitive interface declarations", () => {
      context.finishWork();
      context.startWork(
        DocumentNode.fromSource(/* GraphQL */ `
          interface Node {
            id: ID!
          }

          interface Timestamped implements Node {
            id: ID!
            createdAt: DateTime!
            updatedAt: DateTime!
          }

          type User implements Timestamped {
            name: String!
          }
        `)
      );

      const user = context.document.getNode("User") as ObjectNode;
      plugin.normalize(user);

      // User should transitively implement Node via Timestamped
      expect(user.hasInterface("Node")).toBe(true);
      expect(user.hasInterface("Timestamped")).toBe(true);

      // User should have all fields from both interfaces
      expect(user.hasField("id")).toBe(true);
      expect(user.hasField("createdAt")).toBe(true);
      expect(user.hasField("updatedAt")).toBe(true);
    });

    it("adds transitive interface fields", () => {
      context.finishWork();
      context.startWork(
        DocumentNode.fromSource(/* GraphQL */ `
          interface Node {
            id: ID!
          }

          interface Timestamped implements Node {
            id: ID!
            createdAt: DateTime!
          }

          type User implements Timestamped {
            name: String!
          }
        `)
      );

      const user = context.document.getNode("User") as ObjectNode;
      plugin.normalize(user);

      // Should have id from Node (transitive via Timestamped)
      expect(user.hasField("id")).toBe(true);
      expect(user.getField("id")?.type.getTypeName()).toBe("ID");
    });

    it("does nothing when type has no interfaces", () => {
      context.finishWork();
      context.startWork(
        DocumentNode.fromSource(/* GraphQL */ `
          type User {
            id: ID!
            name: String!
          }
        `)
      );

      const user = context.document.getNode("User") as ObjectNode;
      const fieldCountBefore = user.fields?.length;
      plugin.normalize(user);

      expect(user.fields?.length).toBe(fieldCountBefore);
    });

    it("handles deeply nested transitive interfaces", () => {
      context.finishWork();
      context.startWork(
        DocumentNode.fromSource(/* GraphQL */ `
          interface Base {
            id: ID!
          }

          interface Node implements Base {
            id: ID!
            nodeType: String!
          }

          interface Entity implements Node & Base {
            id: ID!
            nodeType: String!
            entityName: String!
          }

          type User implements Entity {
            name: String!
          }
        `)
      );

      const user = context.document.getNode("User") as ObjectNode;
      plugin.normalize(user);

      expect(user.hasInterface("Entity")).toBe(true);
      expect(user.hasInterface("Node")).toBe(true);
      expect(user.hasInterface("Base")).toBe(true);

      expect(user.hasField("id")).toBe(true);
      expect(user.hasField("nodeType")).toBe(true);
      expect(user.hasField("entityName")).toBe(true);
    });

    it("preserves existing field types when they match interface", () => {
      context.finishWork();
      context.startWork(
        DocumentNode.fromSource(/* GraphQL */ `
          interface Node {
            id: ID!
          }

          type User implements Node {
            id: ID!
            name: String!
          }
        `)
      );

      const user = context.document.getNode("User") as ObjectNode;
      plugin.normalize(user);

      expect(user.getField("id")?.type.getTypeName()).toBe("ID");
    });

    it("enforces interface field type when implementor has mismatched type", () => {
      context.finishWork();
      context.startWork(
        DocumentNode.fromSource(/* GraphQL */ `
          interface Timestamped {
            createdAt: DateTime!
            updatedAt: DateTime!
          }

          type User implements Timestamped {
            id: ID!
            createdAt: String
            updatedAt: Int
          }
        `)
      );

      const user = context.document.getNode("User") as ObjectNode;
      plugin.normalize(user);

      expect(user.getField("createdAt")?.type.getTypeName()).toBe("DateTime");
      expect(user.getField("updatedAt")?.type.getTypeName()).toBe("DateTime");
    });
  });
});
