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
    const field = FieldNode.create("id", NonNullTypeNode.create("ID"));

    expect(isSemanticNullable(field)).toBe(false);
  });

  it("returns `false` for NonNull fields even with @semanticNonNull", () => {
    const field = FieldNode.create("id", NonNullTypeNode.create("ID"), null, [
      DirectiveNode.create(RfcDirective.SEMANTIC_NON_NULL),
    ]);

    expect(isSemanticNullable(field)).toBe(false);
  });

  it("returns `true` for nullable fields without @semanticNonNull", () => {
    const field = FieldNode.create("bio", NamedTypeNode.create("String"));

    expect(isSemanticNullable(field)).toBe(true);
  });

  it("returns `false` for fields with @semanticNonNull at default level 0", () => {
    const directive = DirectiveNode.create(RfcDirective.SEMANTIC_NON_NULL).addArgument(
      ArgumentNode.create("levels", ValueNode.list([ValueNode.int(0)]))
    );

    const field = FieldNode.create("name", NamedTypeNode.create("String"), null, [directive]);

    expect(isSemanticNullable(field, 0)).toBe(false);
  });

  it("returns true for fields with @semanticNonNull at a non-matching level", () => {
    const directive = DirectiveNode.create(RfcDirective.SEMANTIC_NON_NULL).addArgument(
      ArgumentNode.create("levels", ValueNode.list([ValueNode.int(0)]))
    );

    const field = FieldNode.create("name", NamedTypeNode.create("String"), null, [directive]);

    expect(isSemanticNullable(field, 1)).toBe(true);
  });

  it("returns false for fields with @semanticNonNull at multiple levels", () => {
    const directive = DirectiveNode.create(RfcDirective.SEMANTIC_NON_NULL).addArgument(
      ArgumentNode.create("levels", ValueNode.list([ValueNode.int(0), ValueNode.int(1)]))
    );

    const field = FieldNode.create(
      "tags",
      ListTypeNode.create(NamedTypeNode.create("String")),
      null,
      [directive]
    );

    expect(isSemanticNullable(field, 0)).toBe(false);
    expect(isSemanticNullable(field, 1)).toBe(false);
    expect(isSemanticNullable(field, 2)).toBe(true);
  });

  it("defaults to level 0 when no level argument is passed", () => {
    const directive = DirectiveNode.create(RfcDirective.SEMANTIC_NON_NULL);

    const field = FieldNode.create("name", NamedTypeNode.create("String"), null, [directive]);

    // default level = 0, which is in the levels array → not nullable
    expect(isSemanticNullable(field)).toBe(false);
  });
});
