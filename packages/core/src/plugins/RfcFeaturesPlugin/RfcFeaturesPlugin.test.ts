import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { print } from "graphql";
import { TransformerContext } from "../../context/index.js";
import {
  DocumentNode,
  DirectiveDefinitionNode,
  ObjectNode,
  FieldNode,
  NamedTypeNode,
  NonNullTypeNode,
  ListTypeNode,
  DirectiveNode,
  ArgumentNode,
  ValueNode,
} from "../../definition/index.js";
import { RfcFeaturesPlugin } from "./RfcFeaturesPlugin.js";
import { createTransformer } from "../../transformer/index.js";
import { isSemanticNullable, RfcDirective } from "./RfcFeaturesPlugin.utils.js";

describe("RfcFeaturesPlugin", () => {
  let plugin: RfcFeaturesPlugin;
  let context: TransformerContext;

  beforeAll(() => {
    context = new TransformerContext();
    plugin = new RfcFeaturesPlugin(context);
    context.registerPlugin(plugin);
  });

  beforeEach(() => {
    context.finishWork();
    context.startWork(
      DocumentNode.fromSource(/* GraphQL */ `
        type User {
          id: ID!
          name: String @semanticNonNull
          tags: [String] @semanticNonNull(levels: [0, 1])
          bio: String
        }

        type Query {
          me: User
        }
      `)
    );
  });

  it("adds the semanticNonNull directive definition", () => {
    const directive = context.document.getNode(RfcDirective.SEMANTIC_NON_NULL);

    expect(directive).toBeDefined();
    expect(directive).toBeInstanceOf(DirectiveDefinitionNode);
  });

  it("preserves @semanticNonNull on schema fields", () => {
    const userNode = context.document.getNode("User") as ObjectNode;
    const nameField = userNode.getField("name");
    const tagsField = userNode.getField("tags");

    expect(nameField).toBeDefined();
    expect(tagsField).toBeDefined();
    expect(nameField?.hasDirective(RfcDirective.SEMANTIC_NON_NULL)).toBe(true);
    expect(tagsField?.hasDirective(RfcDirective.SEMANTIC_NON_NULL)).toBe(true);
  });
});

describe("isSemanticNullable", () => {
  it("returns `false` for NonNull fields (regardless of directive)", () => {
    const field = FieldNode.create("id", undefined, undefined, NonNullTypeNode.create("ID"));

    expect(isSemanticNullable(field)).toBe(false);
  });

  it("returns `false` for NonNull fields even with @semanticNonNull", () => {
    const field = FieldNode.create(
      "id",
      undefined,
      [DirectiveNode.create(RfcDirective.SEMANTIC_NON_NULL)],
      NonNullTypeNode.create("ID"),
      null
    );

    expect(isSemanticNullable(field)).toBe(false);
  });

  it("returns `true` for nullable fields without @semanticNonNull", () => {
    const field = FieldNode.create("bio", undefined, undefined, NamedTypeNode.create("String"));

    expect(isSemanticNullable(field)).toBe(true);
  });

  it("returns `false` for fields with @semanticNonNull at default level 0", () => {
    const directive = DirectiveNode.create(RfcDirective.SEMANTIC_NON_NULL).addArgument(
      ArgumentNode.create("levels", ValueNode.list([ValueNode.int(0)]))
    );

    const field = FieldNode.create(
      "name",
      undefined,
      [directive],
      NamedTypeNode.create("String"),
      null
    );

    expect(isSemanticNullable(field, 0)).toBe(false);
  });

  it("returns true for fields with @semanticNonNull at a non-matching level", () => {
    const directive = DirectiveNode.create(RfcDirective.SEMANTIC_NON_NULL).addArgument(
      ArgumentNode.create("levels", ValueNode.list([ValueNode.int(0)]))
    );

    const field = FieldNode.create(
      "name",
      undefined,
      [directive],
      NamedTypeNode.create("String"),
      null
    );

    expect(isSemanticNullable(field, 1)).toBe(true);
  });

  it("returns false for fields with @semanticNonNull at multiple levels", () => {
    const directive = DirectiveNode.create(RfcDirective.SEMANTIC_NON_NULL).addArgument(
      ArgumentNode.create("levels", ValueNode.list([ValueNode.int(0), ValueNode.int(1)]))
    );

    const field = FieldNode.create(
      "tags",
      undefined,
      [directive],
      ListTypeNode.create(NamedTypeNode.create("String")),
      null
    );

    expect(isSemanticNullable(field, 0)).toBe(false);
    expect(isSemanticNullable(field, 1)).toBe(false);
    expect(isSemanticNullable(field, 2)).toBe(true);
  });

  it("defaults to level 0 when no level argument is passed", () => {
    const directive = DirectiveNode.create(RfcDirective.SEMANTIC_NON_NULL);

    const field = FieldNode.create(
      "name",
      undefined,
      [directive],
      NamedTypeNode.create("String"),
      null
    );

    // default level = 0, which is in the levels array → not nullable
    expect(isSemanticNullable(field)).toBe(false);
  });

  it("detects NonNull inside a list at level 1: [String!]", () => {
    // [String!] — the list is nullable, but the inner String! is non-null at level 1
    const field = FieldNode.create(
      "tags",
      undefined,
      undefined,
      ListTypeNode.create(NonNullTypeNode.create("String"))
    );

    expect(isSemanticNullable(field, 0)).toBe(true); // list itself is nullable
    expect(isSemanticNullable(field, 1)).toBe(false); // String! is non-null
  });

  it("detects NonNull list wrapper at level 0: [String]!", () => {
    // [String]! — the list is non-null, but inner String is nullable
    const field = FieldNode.create(
      "tags",
      undefined,
      undefined,
      NonNullTypeNode.create(ListTypeNode.create(NamedTypeNode.create("String")))
    );

    expect(isSemanticNullable(field, 0)).toBe(false); // [String]! is non-null
    expect(isSemanticNullable(field, 1)).toBe(true); // String is nullable
  });

  it("handles fully non-null list: [String!]!", () => {
    // [String!]! — both levels are non-null
    const field = FieldNode.create(
      "tags",
      undefined,
      undefined,
      NonNullTypeNode.create(ListTypeNode.create(NonNullTypeNode.create("String")))
    );

    expect(isSemanticNullable(field, 0)).toBe(false);
    expect(isSemanticNullable(field, 1)).toBe(false);
  });

  it("combines schema NonNull with @semanticNonNull on lists", () => {
    // [String] @semanticNonNull — list is semantically non-null, inner String is nullable
    const directive = DirectiveNode.create(RfcDirective.SEMANTIC_NON_NULL).addArgument(
      ArgumentNode.create("levels", ValueNode.list([ValueNode.int(0)]))
    );

    const field = FieldNode.create(
      "tags",
      undefined,
      [directive],
      ListTypeNode.create(NamedTypeNode.create("String")),
      null
    );

    expect(isSemanticNullable(field, 0)).toBe(false); // covered by @semanticNonNull
    expect(isSemanticNullable(field, 1)).toBe(true); // not covered
  });

  it("uses @semanticNonNull at level 1 for inner list items", () => {
    // [String] @semanticNonNull(levels: [1]) — list is nullable, inner items are semantically non-null
    const directive = DirectiveNode.create(RfcDirective.SEMANTIC_NON_NULL).addArgument(
      ArgumentNode.create("levels", ValueNode.list([ValueNode.int(1)]))
    );

    const field = FieldNode.create(
      "tags",
      undefined,
      [directive],
      ListTypeNode.create(NamedTypeNode.create("String")),
      null
    );

    expect(isSemanticNullable(field, 0)).toBe(true); // level 0 not in levels
    expect(isSemanticNullable(field, 1)).toBe(false); // level 1 is in levels
  });

  it("handles deeply nested lists: [[String]] @semanticNonNull(levels: [0, 2])", () => {
    // [[String]] — level 0 = outer list, level 1 = inner list, level 2 = String
    const directive = DirectiveNode.create(RfcDirective.SEMANTIC_NON_NULL).addArgument(
      ArgumentNode.create("levels", ValueNode.list([ValueNode.int(0), ValueNode.int(2)]))
    );

    const field = FieldNode.create(
      "matrix",
      undefined,
      [directive],
      ListTypeNode.create(ListTypeNode.create(NamedTypeNode.create("String"))),
      null
    );

    expect(isSemanticNullable(field, 0)).toBe(false); // outer list — covered
    expect(isSemanticNullable(field, 1)).toBe(true); // inner list — not covered
    expect(isSemanticNullable(field, 2)).toBe(false); // String — covered
  });

  it("schema NonNull takes precedence over missing @semanticNonNull level", () => {
    // [String!] @semanticNonNull(levels: [0]) — level 1 is non-null via schema, not directive
    const directive = DirectiveNode.create(RfcDirective.SEMANTIC_NON_NULL).addArgument(
      ArgumentNode.create("levels", ValueNode.list([ValueNode.int(0)]))
    );

    const field = FieldNode.create(
      "tags",
      undefined,
      [directive],
      ListTypeNode.create(NonNullTypeNode.create("String")),
      null
    );

    expect(isSemanticNullable(field, 0)).toBe(false); // covered by directive
    expect(isSemanticNullable(field, 1)).toBe(false); // covered by schema NonNull
  });
});

describe("RfcFeaturesPlugin force", () => {
  let plugin: RfcFeaturesPlugin;
  let context: TransformerContext;

  beforeAll(() => {
    context = new TransformerContext({ semanticNullability: "force" });
    plugin = new RfcFeaturesPlugin(context);
    context.registerPlugin(plugin);
  });

  beforeEach(() => {
    context.finishWork();
    context.startWork(
      DocumentNode.fromSource(/* GraphQL */ `
        interface Named {
          name: String!
        }

        type User implements Named {
          id: ID!
          name: String!
          tags: [String!]!
          matrix: [[Int!]]!
          aliases: [String!] @semanticNonNull
          bio: String
          nickname: String @semanticNonNull
          posts(first: Int!): [String]
        }

        input UserInput {
          name: String!
        }
      `)
    );

    for (const name of ["Named", "User"]) {
      const node = context.document.getNodeOrThrow(name) as ObjectNode;

      if (plugin.match(node)) {
        plugin.cleanup(node);
      }
    }
  });

  it("moves a non-null field into @semanticNonNull", () => {
    const field = (context.document.getNodeOrThrow("User") as ObjectNode).getField("name");

    expect(field && print(field.serialize())).toBe("name: String @semanticNonNull");
  });

  it("keeps the list structure, level by level", () => {
    const user = context.document.getNodeOrThrow("User") as ObjectNode;
    const tags = user.getField("tags");
    const matrix = user.getField("matrix");

    expect(tags && print(tags.serialize())).toBe("tags: [String] @semanticNonNull(levels: [0, 1])");
    expect(matrix && print(matrix.serialize())).toBe(
      "matrix: [[Int]] @semanticNonNull(levels: [0, 2])"
    );
  });

  it("merges the levels a field already declares", () => {
    const field = (context.document.getNodeOrThrow("User") as ObjectNode).getField("aliases");

    expect(field && print(field.serialize())).toBe(
      "aliases: [String] @semanticNonNull(levels: [0, 1])"
    );
  });

  it("keeps id non-null", () => {
    const field = (context.document.getNodeOrThrow("User") as ObjectNode).getField("id");

    expect(field && print(field.serialize())).toBe("id: ID!");
  });

  it("leaves nullable fields and arguments as they are", () => {
    const user = context.document.getNodeOrThrow("User") as ObjectNode;
    const bio = user.getField("bio");
    const nickname = user.getField("nickname");
    const posts = user.getField("posts");

    expect(bio && print(bio.serialize())).toBe("bio: String");
    expect(nickname && print(nickname.serialize())).toBe("nickname: String @semanticNonNull");
    expect(posts && print(posts.serialize())).toBe("posts(first: Int!): [String]");
  });

  it("converts interfaces alike, so implementations still match", () => {
    const named = context.document.getNodeOrThrow("Named") as ObjectNode;
    const field = named.getField("name");

    expect(field && print(field.serialize())).toBe("name: String @semanticNonNull");
    expect(context.document.validate()).toEqual([]);
  });

  it("does not match input types", () => {
    expect(plugin.match(context.document.getNodeOrThrow("UserInput"))).toBe(false);
  });
});

describe("RfcFeaturesPlugin force in the pipeline", () => {
  let schema: string;
  let types: string;

  beforeAll(() => {
    const output = createTransformer({ relay: true, semanticNullability: "force" }).transform(
      /* GraphQL */ `
        type User @model {
          name: String!
          posts: [Post!]! @hasMany
        }

        type Post @model {
          title: String!
          author: User! @belongsTo
        }
      `
    );

    schema = output.schema;
    types = output.files.find((file) => file.path === "schema.types.ts")?.content ?? "";
  });

  it("prints output fields with @semanticNonNull", () => {
    const user = schema.match(/type User implements Node \{[^}]*\}/)?.[0] ?? "";

    expect(user).toContain("id: ID!");
    expect(user).toContain("name: String @semanticNonNull");
    expect(user).toContain("posts(");
    expect(user).toContain("): PostConnection @semanticNonNull");
  });

  it("converts generated types", () => {
    const pageInfo = schema.match(/type PageInfo \{[^}]*\}/)?.[0] ?? "";

    expect(pageInfo).toContain("hasNextPage: Boolean @semanticNonNull");
  });

  it("keeps create inputs required", () => {
    const createUser = schema.match(/input CreateUserInput \{[^}]*\}/)?.[0] ?? "";

    expect(createUser).toContain("name: String!");
  });

  it("keeps the generated types non-null", () => {
    expect(types).toMatch(/name: Scalars\["String"\]\["output"\];/);
  });
});

describe("RfcFeaturesPlugin force without relay", () => {
  let schema: string;

  beforeAll(() => {
    schema = createTransformer({ semanticNullability: "force" }).transform(/* GraphQL */ `
      type User @model {
        id: ID!
        posts: Post! @hasMany
        drafts: [Post] @hasMany
      }

      type Post @model {
        id: ID!
        author: User! @belongsTo
      }
    `).schema;
  });

  it("converts the list a @hasMany wraps a bare type in", () => {
    const user = schema.match(/type User \{[^}]*\}/)?.[0] ?? "";

    expect(user).toMatch(/posts\([^)]*\): \[Post\] @semanticNonNull\(levels: \[0, 1\]\)/);
  });

  it("leaves a list written as nullable as it is", () => {
    const user = schema.match(/type User \{[^}]*\}/)?.[0] ?? "";

    expect(user).toMatch(/drafts\([^)]*\): \[Post\]\n/);
  });
});
