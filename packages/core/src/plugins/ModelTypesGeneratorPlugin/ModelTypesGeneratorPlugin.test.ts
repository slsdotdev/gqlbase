import { beforeAll, describe, expect, it } from "vitest";
import { TransformerContext } from "../../context/index.js";
import { DocumentNode, ObjectNode } from "../../definition/index.js";
import { ModelTypesGeneratorPlugin } from "./ModelTypesGeneratorPlugin.js";
import { createTransformer } from "../../transformer/index.js";

const generateTypes = (
  plugin: ModelTypesGeneratorPlugin,
  context: TransformerContext,
  schema: string
) => {
  context.finishWork();
  context.startWork(DocumentNode.fromSource(schema));

  plugin.before();

  const userNode = context.document.getNode("User") as ObjectNode;
  plugin.generate(userNode);

  const result = plugin.output() as { modelTypes: string };
  return result.modelTypes;
};

describe("ModelTypesGeneratorPlugin", () => {
  describe("basic type generation", () => {
    let plugin: ModelTypesGeneratorPlugin;
    let context: TransformerContext;

    beforeAll(() => {
      context = new TransformerContext();
      plugin = new ModelTypesGeneratorPlugin(context, { emitOutput: true });
      context.registerPlugin(plugin);
    });

    it("generates nullable type for plain nullable fields", () => {
      const output = generateTypes(
        plugin,
        context,
        /* GraphQL */ `
          type User {
            bio: String
          }
          type Query {
            me: User
          }
        `
      );

      expect(output).toContain("bio?: Maybe<string>");
    });

    it("generates non-null type for schema NonNull fields", () => {
      const output = generateTypes(
        plugin,
        context,
        /* GraphQL */ `
          type User {
            id: ID!
          }
          type Query {
            me: User
          }
        `
      );

      expect(output).toContain("id: string");
      expect(output).not.toMatch(/id\?/);
    });

    it("generates nullable list with nullable items: [String]", () => {
      const output = generateTypes(
        plugin,
        context,
        /* GraphQL */ `
          type User {
            tags: [String]
          }
          type Query {
            me: User
          }
        `
      );

      expect(output).toContain("tags?: Maybe<Maybe<string>[]>");
    });

    it("generates non-null list with non-null items: [String!]!", () => {
      const output = generateTypes(
        plugin,
        context,
        /* GraphQL */ `
          type User {
            tags: [String!]!
          }
          type Query {
            me: User
          }
        `
      );

      expect(output).toContain("tags: string[]");
      expect(output).not.toMatch(/tags\?/);
    });

    it("generates non-null list with nullable items: [String]!", () => {
      const output = generateTypes(
        plugin,
        context,
        /* GraphQL */ `
          type User {
            tags: [String]!
          }
          type Query {
            me: User
          }
        `
      );

      expect(output).toContain("tags: Maybe<string>[]");
      expect(output).not.toMatch(/tags\?/);
    });

    it("generates nullable list with non-null items: [String!]", () => {
      const output = generateTypes(
        plugin,
        context,
        /* GraphQL */ `
          type User {
            tags: [String!]
          }
          type Query {
            me: User
          }
        `
      );

      expect(output).toContain("tags?: Maybe<string[]>");
    });
  });

  describe("semantic nullability in type generation", () => {
    let plugin: ModelTypesGeneratorPlugin;
    let context: TransformerContext;

    beforeAll(() => {
      context = new TransformerContext();
      plugin = new ModelTypesGeneratorPlugin(context, { emitOutput: true });
      context.registerPlugin(plugin);
    });

    it("generates non-null type for fields with @semanticNonNull", () => {
      const output = generateTypes(
        plugin,
        context,
        /* GraphQL */ `
          type User {
            username: String @semanticNonNull
          }
          type Query {
            me: User
          }
        `
      );

      expect(output).toContain("username: string");
      expect(output).not.toMatch(/username\?/);
    });

    it("wraps list items with Maybe when only list level is @semanticNonNull", () => {
      const output = generateTypes(
        plugin,
        context,
        /* GraphQL */ `
          type User {
            tags: [String] @semanticNonNull
          }
          type Query {
            me: User
          }
        `
      );

      // level 0 non-null (directive), level 1 nullable (not specified)
      expect(output).toContain("tags: Maybe<string>[]");
      expect(output).not.toMatch(/tags\?/);
    });

    it("generates fully non-null list when all levels are @semanticNonNull", () => {
      const output = generateTypes(
        plugin,
        context,
        /* GraphQL */ `
          type User {
            tags: [String] @semanticNonNull(levels: [0, 1])
          }
          type Query {
            me: User
          }
        `
      );

      expect(output).toContain("tags: string[]");
      expect(output).not.toMatch(/tags\?/);
      expect(output).not.toContain("Maybe<string>[]");
    });

    it("generates nullable list with non-null items for @semanticNonNull(levels: [1])", () => {
      const output = generateTypes(
        plugin,
        context,
        /* GraphQL */ `
          type User {
            tags: [String] @semanticNonNull(levels: [1])
          }
          type Query {
            me: User
          }
        `
      );

      // level 0 nullable, level 1 non-null
      expect(output).toContain("tags?: Maybe<string[]>");
    });

    it("combines schema NonNull with @semanticNonNull on lists", () => {
      const output = generateTypes(
        plugin,
        context,
        /* GraphQL */ `
          type User {
            tags: [String!] @semanticNonNull
          }
          type Query {
            me: User
          }
        `
      );

      // level 0 covered by @semanticNonNull, level 1 covered by String!
      expect(output).toContain("tags: string[]");
      expect(output).not.toMatch(/tags\?/);
    });
  });
});

describe("ModelTypesGeneratorPlugin output schema", () => {
  let content: string;

  beforeAll(() => {
    const output = createTransformer().transform(/* GraphQL */ `
      enum Visibility {
        PUBLIC
        HIDDEN
      }

      enum Unused {
        A
      }

      type Author @model {
        id: ID!
        name: String!
      }

      type Post @model {
        id: ID!
        title: String!
        author: Author @belongsTo
        importRef: String @writeOnly
        deletedAt: String @serverOnly
        visibility: Visibility @serverOnly
      }
    `);

    content = output.files.find((file) => file.path === "models.typegen.ts")?.content ?? "";
  });

  it("keeps public fields", () => {
    expect(content).toMatch(/export type Post = \{[^}]*title: string;/);
    expect(content).toMatch(/export type Post = \{[^}]*author\?: Maybe<Author>;/);
  });

  it("omits @serverOnly and @writeOnly fields and relation keys", () => {
    const post = content.match(/export type Post = \{[^}]*\}/)?.[0] ?? "";

    expect(post).not.toContain("authorId");
    expect(post).not.toContain("importRef");
    expect(post).not.toContain("deletedAt");
    expect(post).not.toContain("visibility");
  });

  it("omits definitions that are not in the output schema", () => {
    expect(content).not.toContain("export type Visibility");
    expect(content).not.toContain("export type Unused");
    expect(content).toContain("export type CreatePostInput");
  });
});
