import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { print } from "graphql";
import { TransformerContext } from "../../context/index.js";
import { DocumentNode, ListTypeNode, ObjectNode } from "../../definition/index.js";
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

  type Viewer {
    user: User @belongsTo @clientOnly
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

  it("does not modify client-only fields", () => {
    const viewerNode = context.document.getNodeOrThrow("Viewer") as ObjectNode;

    plugin.normalize(viewerNode);
    plugin.execute(viewerNode);

    expect(viewerNode.getField("user")?.type.getTypeName()).toBe("User");
    expect(viewerNode.hasField("userId")).toBeFalsy();
  });
});

describe("RelationsPlugin list shape", () => {
  const source = /* GraphQL */ `
    type User {
      id: ID!
      posts: Post @hasMany
      drafts: Post! @hasMany
      pinned: [Post] @hasMany
      archived: Post @hasMany @semanticNonNull
    }

    type Post {
      id: ID!
    }
  `;

  describe("with relay off", () => {
    let context: TransformerContext;
    let user: ObjectNode;

    beforeAll(() => {
      context = new TransformerContext({ semanticNullability: true });
      const plugin = new RelationsPlugin(context);
      context.registerPlugin(plugin);
      context.startWork(DocumentNode.fromSource(source));
      user = context.document.getNodeOrThrow("User") as ObjectNode;
      plugin.execute(user);
    });

    it("turns a nullable @hasMany into a nullable list of non-null items", () => {
      const posts = user.getField("posts")?.type;
      expect(posts && print(posts.serialize())).toBe("[Post!]");
    });

    it("turns a non-null @hasMany into a non-null list of non-null items", () => {
      const drafts = user.getField("drafts")?.type;
      expect(drafts && print(drafts.serialize())).toBe("[Post!]!");
    });

    it("keeps @semanticNonNull on the field", () => {
      const field = user.getField("archived");

      expect(field && print(field.type.serialize())).toBe("[Post!]");
      expect(field?.hasDirective("semanticNonNull")).toBe(true);
    });

    it("leaves a type already written as a list as written", () => {
      const pinned = user.getField("pinned")?.type;
      expect(pinned && print(pinned.serialize())).toBe("[Post]");
    });

    it("adds no pagination arguments", () => {
      expect(user.getField("posts")?.arguments ?? []).toEqual([]);
    });
  });

  describe("with relay on", () => {
    let context: TransformerContext;
    let user: ObjectNode;

    beforeAll(() => {
      context = new TransformerContext({ relay: true });
      const plugin = new RelationsPlugin(context);
      context.registerPlugin(plugin);
      context.startWork(DocumentNode.fromSource(source.replace("@semanticNonNull", "")));
      user = context.document.getNodeOrThrow("User") as ObjectNode;
      plugin.execute(user);
    });

    it("leaves @hasMany fields for ConnectionPlugin", () => {
      const posts = user.getField("posts")?.type;
      expect(posts && print(posts.serialize())).toBe("Post");
      const drafts = user.getField("drafts")?.type;
      expect(drafts && print(drafts.serialize())).toBe("Post!");
    });
  });
});
