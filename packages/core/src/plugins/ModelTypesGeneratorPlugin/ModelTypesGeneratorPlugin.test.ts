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

  return plugin.output().schemaTypes;
};

describe("ModelTypesGeneratorPlugin", () => {
  describe("basic type generation", () => {
    let plugin: ModelTypesGeneratorPlugin;
    let context: TransformerContext;

    beforeAll(() => {
      context = new TransformerContext();
      plugin = new ModelTypesGeneratorPlugin(context);
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

      expect(output).toContain('bio?: Maybe<Scalars["String"]["output"]>');
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

      expect(output).toContain('id: Scalars["ID"]["output"]');
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

      expect(output).toContain('tags?: Maybe<Maybe<Scalars["String"]["output"]>[]>');
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

      expect(output).toContain('tags: Scalars["String"]["output"][]');
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

      expect(output).toContain('tags: Maybe<Scalars["String"]["output"]>[]');
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

      expect(output).toContain('tags?: Maybe<Scalars["String"]["output"][]>');
    });
  });

  describe("semantic nullability in type generation", () => {
    let plugin: ModelTypesGeneratorPlugin;
    let context: TransformerContext;

    beforeAll(() => {
      context = new TransformerContext();
      plugin = new ModelTypesGeneratorPlugin(context);
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

      expect(output).toContain('username: Scalars["String"]["output"]');
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
      expect(output).toContain('tags: Maybe<Scalars["String"]["output"]>[]');
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

      expect(output).toContain('tags: Scalars["String"]["output"][]');
      expect(output).not.toMatch(/tags\?/);
      expect(output).not.toContain('Maybe<Scalars["String"]["output"]>[]');
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
      expect(output).toContain('tags?: Maybe<Scalars["String"]["output"][]>');
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
      expect(output).toContain('tags: Scalars["String"]["output"][]');
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

    content = output.files.find((file) => file.path === "schema.types.ts")?.content ?? "";
  });

  it("keeps public fields", () => {
    expect(content).toMatch(
      /export type PostOwnFields = \{[^}]*title: Scalars\["String"\]\["output"\];/
    );
    expect(content).toMatch(/export type PostRelations = \{\s+author\?: Maybe<AuthorFull>;\s+\};/);
    expect(content).toContain("export type PostFull = PostOwnFields & PostRelations;");
  });

  it("omits @serverOnly and @writeOnly fields and relation keys", () => {
    const post = content.match(/export type PostOwnFields = \{[^}]*\}/)?.[0] ?? "";

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

describe("ModelTypesGeneratorPlugin parts", () => {
  let content: string;

  beforeAll(() => {
    const output = createTransformer().transform(/* GraphQL */ `
      scalar Json @gqlbase_typehint(type: object, input: string)

      interface Node {
        id: ID!
      }

      type Author implements Node @model {
        id: ID!
        name: String!
        posts: Post! @hasMany
      }

      type Post implements Node @model {
        id: ID!
        meta: Json
        price: Money!
        author: Author @belongsTo
      }

      type Money {
        amount: Int!
      }

      union FeedItem = Author | Post

      type Query {
        feed(filter: Json): [FeedItem!]!
        node(id: ID!): Node
      }
    `);

    content = output.files.find((file) => file.path === "schema.types.ts")?.content ?? "";
  });

  it("splits an object into its own fields, its relations, and both", () => {
    expect(content).toMatch(
      /export type PostOwnFields = \{\s+id: Scalars\["ID"\]\["output"\];\s+meta\?: Maybe<Scalars\["Json"\]\["output"\]>;\s+price: MoneyFull;\s+\};/
    );
    expect(content).toMatch(/export type PostRelations = \{\s+author\?: Maybe<AuthorFull>;\s+\};/);
    expect(content).toContain("export type PostFull = PostOwnFields & PostRelations;");
  });

  it("splits every object and interface the same way, with or without relations", () => {
    expect(content).toMatch(/export type MoneyRelations = \{\};/);
    expect(content).toContain("export type MoneyFull = MoneyOwnFields & MoneyRelations;");
    expect(content).toContain("export type NodeFull = NodeOwnFields & NodeRelations;");
    expect(content).not.toMatch(/export (type|interface) (Post|Money|Node)\b/);
  });

  it("types a relation as optional, whatever its nullability", () => {
    expect(content).toMatch(/export type AuthorRelations = \{\s+posts\?: PostFull\[\];/);
  });

  it("types a union as the full types of its members", () => {
    expect(content).toContain("export type FeedItem = AuthorFull | PostFull;");
  });

  it("maps each scalar to its input and output type", () => {
    expect(content).toMatch(/ID: \{\s+input: string;\s+output: string;\s+\};/);
    expect(content).toMatch(/Json: \{\s+input: string;\s+output: Record<string, unknown>;\s+\};/);
    expect(content).toMatch(
      /export type CreatePostInput = \{[^}]*meta\?: Maybe<Scalars\["Json"\]\["input"\]>;/
    );
  });

  it("throws when the schema declares a generated name", () => {
    expect(() =>
      createTransformer().transform(/* GraphQL */ `
        type Post @model {
          id: ID!
        }

        type PostFull {
          id: ID!
        }

        type Query {
          full: PostFull
        }
      `)
    ).toThrow(
      /The schema declares PostFull, but the schema types generate PostFull as a part of Post/
    );
  });
});
