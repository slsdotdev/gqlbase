import { beforeAll, describe, expect, it } from "vitest";
import { TransformerContext } from "@gqlbase/core";
import { DocumentNode, ObjectNode } from "@gqlbase/core/definition";
import { ModelTypesGeneratorPlugin } from "./ModelTypesGeneratorPlugin.js";

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

      expect(output).toContain("readonly bio?: Maybe<string>");
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

      expect(output).toContain("readonly id: string");
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

      expect(output).toContain("readonly tags?: Maybe<Maybe<string>[]>");
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

      expect(output).toContain("readonly tags: string[]");
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

      expect(output).toContain("readonly tags: Maybe<string>[]");
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

      expect(output).toContain("readonly tags?: Maybe<string[]>");
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
            name: String @semanticNonNull
          }
          type Query {
            me: User
          }
        `
      );

      expect(output).toContain("readonly name: string");
      expect(output).not.toMatch(/name\?/);
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
      expect(output).toContain("readonly tags: Maybe<string>[]");
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

      expect(output).toContain("readonly tags: string[]");
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
      expect(output).toContain("readonly tags?: Maybe<string[]>");
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
      expect(output).toContain("readonly tags: string[]");
      expect(output).not.toMatch(/tags\?/);
    });
  });
});
