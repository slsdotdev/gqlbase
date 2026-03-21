import { beforeAll, describe, expect, it } from "vitest";
import { TransformerContext } from "@gqlbase/core";
import { DocumentNode, InterfaceNode, NonNullTypeNode, ObjectNode } from "@gqlbase/core/definition";
import { ConnectionPlugin } from "./ConnectionPlugin.js";
import { RelationsPlugin } from "../../base/RelationsPlugin/RelationsPlugin.js";

describe("ConnectionPlugin", () => {
  let context: TransformerContext;
  let relationsPlugin: RelationsPlugin;
  let plugin: ConnectionPlugin;

  beforeAll(() => {
    context = new TransformerContext();
    relationsPlugin = new RelationsPlugin(context);
    plugin = new ConnectionPlugin(context);
    context.registerPlugin(relationsPlugin);
    context.registerPlugin(plugin);
  });

  describe("before", () => {
    it("adds PageInfo type to document", () => {
      context.finishWork();
      context.startWork(
        DocumentNode.fromSource(/* GraphQL */ `
          type Query {
            me: String
          }
        `)
      );

      plugin.before();

      const pageInfo = context.document.getNode("PageInfo") as ObjectNode;

      expect(pageInfo).toBeInstanceOf(ObjectNode);
      expect(pageInfo.hasField("hasNextPage")).toBe(true);
      expect(pageInfo.hasField("hasPreviousPage")).toBe(true);
      expect(pageInfo.hasField("startCursor")).toBe(true);
      expect(pageInfo.hasField("endCursor")).toBe(true);
    });
  });

  describe("match", () => {
    it("matches object types with fields", () => {
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

    it("matches interface types with fields", () => {
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

    it("does not match Mutation type", () => {
      context.finishWork();
      context.startWork(
        DocumentNode.fromSource(/* GraphQL */ `
          type Mutation {
            createUser(name: String!): User
          }

          type User {
            id: ID!
          }
        `)
      );

      const mutation = context.document.getNode("Mutation") as ObjectNode;
      expect(plugin.match(mutation)).toBe(false);
    });

    it("does not match types without fields", () => {
      context.finishWork();
      context.startWork(
        DocumentNode.fromSource(/* GraphQL */ `
          type Empty {
            _: String
          }
        `)
      );

      const empty = context.document.getNode("Empty") as ObjectNode;
      // Remove the field to simulate an empty type
      empty.removeField("_");
      expect(plugin.match(empty)).toBe(false);
    });

    it("does not match connection types", () => {
      context.finishWork();
      context.startWork(
        DocumentNode.fromSource(/* GraphQL */ `
          type UserEdge {
            cursor: String
            node: User
          }

          type UserConnection {
            edges: [UserEdge!]!
            pageInfo: PageInfo!
          }

          type User {
            id: ID!
          }
        `)
      );

      const connection = context.document.getNode("UserConnection") as ObjectNode;
      expect(plugin.match(connection)).toBe(false);
    });

    it("does not match edge types", () => {
      context.finishWork();
      context.startWork(
        DocumentNode.fromSource(/* GraphQL */ `
          type UserEdge {
            cursor: String
            node: User
          }

          type User {
            id: ID!
          }
        `)
      );

      const edge = context.document.getNode("UserEdge") as ObjectNode;
      expect(plugin.match(edge)).toBe(false);
    });
  });

  describe("execute", () => {
    it("creates connection and edge types for @hasMany fields", () => {
      context.finishWork();
      context.startWork(
        DocumentNode.fromSource(/* GraphQL */ `
          type User {
            id: ID!
            posts: Post @hasMany
          }

          type Post {
            id: ID!
            title: String!
          }
        `)
      );

      const user = context.document.getNode("User") as ObjectNode;
      plugin.execute(user);

      const connectionType = context.document.getNode("PostConnection") as ObjectNode;
      const edgeType = context.document.getNode("PostEdge") as ObjectNode;

      expect(connectionType).toBeInstanceOf(ObjectNode);
      expect(edgeType).toBeInstanceOf(ObjectNode);
    });

    it("connection type has edges and pageInfo fields", () => {
      context.finishWork();
      context.startWork(
        DocumentNode.fromSource(/* GraphQL */ `
          type User {
            id: ID!
            posts: Post @hasMany
          }

          type Post {
            id: ID!
            title: String!
          }
        `)
      );

      const user = context.document.getNode("User") as ObjectNode;
      plugin.execute(user);

      const connectionType = context.document.getNode("PostConnection") as ObjectNode;

      expect(connectionType.hasField("edges")).toBe(true);
      expect(connectionType.getField("edges")?.type.getTypeName()).toBe("PostEdge");
      expect(connectionType.hasField("pageInfo")).toBe(true);
      expect(connectionType.getField("pageInfo")?.type.getTypeName()).toBe("PageInfo");
    });

    it("edge type has cursor and node fields", () => {
      context.finishWork();
      context.startWork(
        DocumentNode.fromSource(/* GraphQL */ `
          type User {
            id: ID!
            posts: Post @hasMany
          }

          type Post {
            id: ID!
            title: String!
          }
        `)
      );

      const user = context.document.getNode("User") as ObjectNode;
      plugin.execute(user);

      const edgeType = context.document.getNode("PostEdge") as ObjectNode;

      expect(edgeType.hasField("cursor")).toBe(true);
      expect(edgeType.getField("cursor")?.type.getTypeName()).toBe("String");
      expect(edgeType.hasField("node")).toBe(true);
      expect(edgeType.getField("node")?.type.getTypeName()).toBe("Post");
    });

    it("updates field type to connection type", () => {
      context.finishWork();
      context.startWork(
        DocumentNode.fromSource(/* GraphQL */ `
          type User {
            id: ID!
            posts: Post @hasMany
          }

          type Post {
            id: ID!
            title: String!
          }
        `)
      );

      const user = context.document.getNode("User") as ObjectNode;
      plugin.execute(user);

      const postsField = user.getField("posts");
      expect(postsField?.type.getTypeName()).toBe("PostConnection");
      expect(postsField?.type).toBeInstanceOf(NonNullTypeNode);
    });

    it("adds first and after pagination arguments", () => {
      context.finishWork();
      context.startWork(
        DocumentNode.fromSource(/* GraphQL */ `
          type User {
            id: ID!
            posts: Post @hasMany
          }

          type Post {
            id: ID!
            title: String!
          }
        `)
      );

      const user = context.document.getNode("User") as ObjectNode;
      plugin.execute(user);

      const postsField = user.getField("posts");
      expect(postsField?.hasArgument("first")).toBe(true);
      expect(postsField?.hasArgument("after")).toBe(true);
    });

    it("ignores @hasOne fields", () => {
      context.finishWork();
      context.startWork(
        DocumentNode.fromSource(/* GraphQL */ `
          type Post {
            id: ID!
            author: User @hasOne
          }

          type User {
            id: ID!
            name: String!
          }
        `)
      );

      const post = context.document.getNode("Post") as ObjectNode;
      plugin.execute(post);

      expect(context.document.getNode("UserConnection")).toBeUndefined();
      expect(post.getField("author")?.type.getTypeName()).toBe("User");
    });

    it("ignores fields without relation directives", () => {
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
      plugin.execute(user);

      expect(user.getField("name")?.type.getTypeName()).toBe("String");
    });

    it("does not duplicate connection types when multiple fields reference same target", () => {
      context.finishWork();
      context.startWork(
        DocumentNode.fromSource(/* GraphQL */ `
          type User {
            id: ID!
            posts: Post @hasMany
            drafts: Post @hasMany
          }

          type Post {
            id: ID!
            title: String!
          }
        `)
      );

      const user = context.document.getNode("User") as ObjectNode;
      plugin.execute(user);

      expect(context.document.getNode("PostConnection")).toBeInstanceOf(ObjectNode);
      expect(context.document.getNode("PostEdge")).toBeInstanceOf(ObjectNode);

      expect(user.getField("posts")?.type.getTypeName()).toBe("PostConnection");
      expect(user.getField("drafts")?.type.getTypeName()).toBe("PostConnection");
    });

    it("creates connection types for union targets", () => {
      context.finishWork();
      context.startWork(
        DocumentNode.fromSource(/* GraphQL */ `
          type Document {
            url: String!
          }

          type Message {
            content: String!
          }

          union Resource = Document | Message

          type Todo {
            id: ID!
            resources: Resource @hasMany
          }
        `)
      );

      const todo = context.document.getNode("Todo") as ObjectNode;
      plugin.execute(todo);

      const connectionType = context.document.getNode("ResourceConnection") as ObjectNode;
      const edgeType = context.document.getNode("ResourceEdge") as ObjectNode;

      expect(connectionType).toBeInstanceOf(ObjectNode);
      expect(edgeType).toBeInstanceOf(ObjectNode);
      expect(edgeType.getField("node")?.type.getTypeName()).toBe("Resource");
    });

    it("creates connection types for interface targets", () => {
      context.finishWork();
      context.startWork(
        DocumentNode.fromSource(/* GraphQL */ `
          interface Commentable {
            id: ID!
            body: String!
          }

          type Query {
            comments: Commentable @hasMany
          }
        `)
      );

      const query = context.document.getQueryNode();
      plugin.execute(query);

      const connectionType = context.document.getNode("CommentableConnection") as ObjectNode;
      const edgeType = context.document.getNode("CommentableEdge") as ObjectNode;

      expect(connectionType).toBeInstanceOf(ObjectNode);
      expect(edgeType).toBeInstanceOf(ObjectNode);
      expect(edgeType.getField("node")?.type.getTypeName()).toBe("Commentable");
    });

    it("throws when relation target is not a valid type", () => {
      context.finishWork();
      context.startWork(
        DocumentNode.fromSource(/* GraphQL */ `
          type User {
            id: ID!
            tags: String @hasMany
          }
        `)
      );

      const user = context.document.getNode("User") as ObjectNode;
      expect(() => plugin.execute(user)).toThrow(/not a valid connection target/);
    });

    it("throws when target is a pagination connection type from RelationsPlugin", () => {
      context.finishWork();
      context.startWork(
        DocumentNode.fromSource(/* GraphQL */ `
          type Post {
            id: ID!
            title: String!
          }

          type PostConnection {
            items: [Post]
            nextToken: String
          }

          type User {
            id: ID!
            posts: PostConnection @hasMany
          }
        `)
      );

      const user = context.document.getNode("User") as ObjectNode;
      expect(() => plugin.execute(user)).toThrow(/conflicting pagination connection/);
    });

    it("edge cursor and node fields have @clientOnly directive", () => {
      context.finishWork();
      context.startWork(
        DocumentNode.fromSource(/* GraphQL */ `
          type User {
            id: ID!
            posts: Post @hasMany
          }

          type Post {
            id: ID!
            title: String!
          }
        `)
      );

      const user = context.document.getNode("User") as ObjectNode;
      plugin.execute(user);

      const edgeType = context.document.getNode("PostEdge") as ObjectNode;
      expect(edgeType.getField("cursor")?.hasDirective("clientOnly")).toBe(true);
      expect(edgeType.getField("node")?.hasDirective("clientOnly")).toBe(true);
    });
  });
});
