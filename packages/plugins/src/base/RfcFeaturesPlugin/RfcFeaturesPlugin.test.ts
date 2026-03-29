import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { TransformerContext } from "@gqlbase/core";
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
} from "@gqlbase/core/definition";
import { RfcFeaturesPlugin } from "./RfcFeaturesPlugin.js";
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
