import { beforeAll, describe, expect, it } from "vitest";
import { TransformerContext } from "../../context/index.js";
import { DocumentNode, ObjectNode } from "../../definition/index.js";
import { InternalUtilsPlugin } from "../InternalUtilsPlugin/index.js";
import { UtilitiesPlugin } from "../UtilitiesPlugin/index.js";
import { SchemaGeneratorPlugin } from "./SchemaGeneratorPlugin.js";
import { collectPublicDefinitions, isPublicSchemaField } from "./SchemaGeneratorPlugin.utils.js";

const source = /* GraphQL */ `
  directive @cache(scope: CacheScope!) on FIELD_DEFINITION

  enum CacheScope {
    PUBLIC
    PRIVATE
  }

  enum Unused {
    A
  }

  enum Secret {
    A
  }

  input UnusedInput {
    value: String
  }

  interface Node {
    id: ID!
  }

  type Post implements Node {
    id: ID!
    title: String!
    status: Secret @serverOnly
    importRef: String @writeOnly
    kind: Kind
    tags(filter: TagFilter): [Tag!]
  }

  type Tag {
    name: String
  }

  input TagFilter {
    name: String
  }

  type Page implements Node {
    id: ID!
  }

  union Kind = Article | Video

  type Article {
    body: String
  }

  type Video {
    url: String
  }

  type Orphan @gqlbase_internal {
    id: ID!
  }

  type Query {
    node(id: ID!): Node
    post(id: ID!): Post
    audit: Unused @serverOnly
  }
`;

describe("isPublicSchemaField", () => {
  let context: TransformerContext;
  let post: ObjectNode;

  beforeAll(() => {
    context = new TransformerContext();
    context.registerPlugin(new InternalUtilsPlugin(context));
    context.registerPlugin(new UtilitiesPlugin(context));
    context.startWork(DocumentNode.fromSource(source));
    post = context.document.getNodeOrThrow("Post") as ObjectNode;
  });

  it("is true for plain fields", () => {
    const field = post.getField("title");
    expect(field && isPublicSchemaField(field, post)).toBe(true);
  });

  it("is false for @serverOnly and @writeOnly fields", () => {
    const status = post.getField("status");
    const importRef = post.getField("importRef");

    expect(status && isPublicSchemaField(status, post)).toBe(false);
    expect(importRef && isPublicSchemaField(importRef, post)).toBe(false);
  });

  it("is false for fields of an internal type", () => {
    const orphan = context.document.getNodeOrThrow("Orphan") as ObjectNode;
    const field = orphan.getField("id");

    expect(field && isPublicSchemaField(field, orphan)).toBe(false);
  });
});

describe("collectPublicDefinitions", () => {
  let context: TransformerContext;
  let reached: Set<string>;

  beforeAll(() => {
    context = new TransformerContext();
    context.registerPlugin(new InternalUtilsPlugin(context));
    context.registerPlugin(new UtilitiesPlugin(context));
    context.startWork(DocumentNode.fromSource(source));
    reached = collectPublicDefinitions(context);
  });

  it("reaches types through public fields, arguments and input fields", () => {
    expect(reached).toContain("Post");
    expect(reached).toContain("Tag");
    expect(reached).toContain("TagFilter");
  });

  it("reaches union members and interface implementors", () => {
    expect(reached).toContain("Article");
    expect(reached).toContain("Video");
    expect(reached).toContain("Page");
  });

  it("reaches argument types of directives declared in the source", () => {
    expect(reached).toContain("CacheScope");
  });

  it("does not reach types used only by hidden fields", () => {
    expect(reached).not.toContain("Secret");
    expect(reached).not.toContain("Unused");
  });

  it("does not reach unreferenced or internal definitions", () => {
    expect(reached).not.toContain("UnusedInput");
    expect(reached).not.toContain("Orphan");
    expect(reached).not.toContain("TypeHint");
  });
});

describe("SchemaGeneratorPlugin", () => {
  let context: TransformerContext;
  let schema: string;

  beforeAll(() => {
    context = new TransformerContext();
    const plugin = new SchemaGeneratorPlugin(context);
    context.registerPlugin(new InternalUtilsPlugin(context));
    context.registerPlugin(new UtilitiesPlugin(context));
    context.registerPlugin(plugin);
    context.startWork(DocumentNode.fromSource(source));

    const post = context.document.getNodeOrThrow("Post") as ObjectNode;
    const query = context.document.getQueryNode();
    post.removeField("status");
    post.removeField("importRef");
    query.removeField("audit");

    ({ schema } = plugin.output());
  });

  it("removes leftover internal definitions", () => {
    expect(context.document.hasNode("Orphan")).toBe(false);
    expect(schema).not.toContain("type Orphan");
  });

  it("removes definitions nothing public reaches", () => {
    expect(schema).not.toContain("enum Unused");
    expect(schema).not.toContain("enum Secret");
    expect(schema).not.toContain("input UnusedInput");
  });

  it("keeps reachable definitions and directive definitions", () => {
    expect(schema).toContain("type Post implements Node");
    expect(schema).toContain("type Video");
    expect(schema).toContain("enum CacheScope");
    expect(schema).toContain("directive @cache");
  });

  it("writes schema.graphql", () => {
    expect(context.files.map((file) => file.path)).toEqual(["schema.graphql"]);
  });
});
