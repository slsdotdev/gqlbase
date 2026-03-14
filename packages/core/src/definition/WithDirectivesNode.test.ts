import { describe, it, expect } from "vitest";
import { ConstDirectiveNode, Kind } from "graphql";
import { WithDirectivesNode } from "./WithDirectivesNode";
import { DirectiveNode } from "./DirectiveNode";

describe("WithDirectives", () => {
  it("checks for directive existence", () => {
    const node = new WithDirectivesNode("WithDirectives");
    expect(node.hasDirective("directive1")).toBe(false);
  });

  it("gets directive from node", () => {
    const node = new WithDirectivesNode("WithDirectives", [DirectiveNode.create("directive1")]);
    const directive = node.getDirective("directive1");
    expect(directive).toBeInstanceOf(DirectiveNode);
    expect(directive?.name).toEqual("directive1");
  });

  it("returns undefiend when directive not found", () => {
    const node = new WithDirectivesNode("WithDirectives");
    const directive = node.getDirective("directive2");
    expect(directive).toBeUndefined();
  });

  it("adds directive to node", () => {
    const node = new WithDirectivesNode("WithDirectives");
    node
      .addDirective("directive1")
      .addDirective(DirectiveNode.create("directive2"))
      .addDirective({
        kind: Kind.DIRECTIVE,
        name: {
          kind: Kind.NAME,
          value: "directive3",
        },
      } as const satisfies ConstDirectiveNode);
    expect(node.directives).toHaveLength(3);
  });

  it("throws error when adding duplicate directive", () => {
    const node = new WithDirectivesNode("WithDirectives");
    node.addDirective("directive1");
    expect(() => node.addDirective("directive1")).toThrow(
      `Directive directive1 already exists on node WithDirectives`
    );
  });

  it("removes directive from node", () => {
    const node = new WithDirectivesNode("WithDirectives");
    node.addDirective("directive1");
    expect(node.directives).toHaveLength(1);
    node.removeDirective("directive1");
    expect(node.directives).toHaveLength(0);
  });
});
