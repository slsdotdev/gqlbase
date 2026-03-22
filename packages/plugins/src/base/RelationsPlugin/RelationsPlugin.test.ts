import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { TransformerContext } from "@gqlbase/core";
import { DocumentNode, ListTypeNode, ObjectNode } from "@gqlbase/core/definition";
import { RelationsPlugin } from "./RelationsPlugin.js";

const document = DocumentNode.fromSource(/* GraphQL */ `
  type User {
    id: ID!
    name: String!
    posts: Post @hasMany(key: "authorId")
  }

  type Post {
    id: ID!
    title: String!
    author: User @hasOne
    tags: Tag @hasMany
  }

  type Tag {
    id: ID!
    name: String!
  }
`);

describe("RelationsPlugin", () => {
  let context: TransformerContext;
  let plugin: RelationsPlugin;

  beforeAll(() => {
    context = new TransformerContext({});
    plugin = new RelationsPlugin(context);
    context.registerPlugin(plugin);
  });

  beforeEach(() => {
    context.finishWork();
    context.startWork(document);
  });

  it("adds relation directive definitions", () => {
    expect(context.document.getNode("hasOne")).toBeDefined();
    expect(context.document.getNode("hasMany")).toBeDefined();
  });

  it("adds keys to relation fields", () => {
    const userNode = context.document.getNodeOrThrow("User") as ObjectNode;
    const postNode = context.document.getNodeOrThrow("Post") as ObjectNode;

    plugin.normalize(userNode);

    expect(postNode.hasField("authorId")).toBeTruthy();
    expect(postNode.getField("authorId")?.type.getTypeName()).toBe("ID");
  });

  it("adds list type to hasMany fields", () => {
    const userNode = context.document.getNodeOrThrow("User") as ObjectNode;
    const postNode = context.document.getNodeOrThrow("Post") as ObjectNode;

    plugin.execute(userNode);
    plugin.execute(postNode);

    expect(userNode.getField("posts")?.type).toBeInstanceOf(ListTypeNode);
    expect(postNode.getField("tags")?.type).toBeInstanceOf(ListTypeNode);
  });

  describe("with useConnections enabled", () => {
    beforeAll(() => {
      context = new TransformerContext({});
      plugin = new RelationsPlugin(context, { usePaginationTypes: true });
      context.registerPlugin(plugin);
    });

    beforeEach(() => {
      context.finishWork();
      context.startWork(document);
    });

    it("transforms hasMany fields to connection types", () => {
      const userNode = context.document.getNodeOrThrow("User") as ObjectNode;
      const postNode = context.document.getNodeOrThrow("Post") as ObjectNode;

      plugin.execute(userNode);
      plugin.execute(postNode);

      expect(userNode.getField("posts")?.type.getTypeName()).toBe("PostConnection");
      expect(postNode.getField("tags")?.type.getTypeName()).toBe("TagConnection");

      expect(userNode.getField("posts")?.getArgument("limit")).toBeDefined();
      expect(userNode.getField("posts")?.getArgument("nextToken")).toBeDefined();
      expect(postNode.getField("tags")?.getArgument("limit")).toBeDefined();
      expect(postNode.getField("tags")?.getArgument("nextToken")).toBeDefined();

      expect(context.document.getNode("PostConnection")).toBeDefined();
      expect(context.document.getNode("TagConnection")).toBeDefined();
    });
  });
});
