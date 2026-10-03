import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { TransformerContext } from "@gqlbase/core";
import { DirectiveDefinitionNode, DocumentNode, ScalarNode } from "@gqlbase/core/definition";
import { AppSyncUtilsPlugin } from "./AppSyncUtilsPlugin.js";
import { AppSyncScalar } from "./AppSyncUtilsPlugin.utils.js";

describe("AppSyncUtilsPlugin", () => {
  let context: TransformerContext;
  let plugin: AppSyncUtilsPlugin;

  beforeAll(() => {
    context = new TransformerContext();
    plugin = new AppSyncUtilsPlugin(context);
    context.registerPlugin(plugin);
  });

  beforeEach(() => {
    context.finishWork();
    context.startWork(
      DocumentNode.fromSource(/* GraphQL */ `
        type Query {
          date: AWSDate
        }
      `)
    );
  });

  describe("scalars", () => {
    it.each(Object.values(AppSyncScalar))("registers %s scalar", (name) => {
      const node = context.document.getNode(name);
      expect(node).toBeInstanceOf(ScalarNode);
    });

    it("maps AWSTimestamp to number type hint", () => {
      const node = context.document.getNode("AWSTimestamp") as ScalarNode;
      const hint = node.getDirective("gqlbase_typehint");
      expect(hint).toBeDefined();
      expect(hint?.getArgumentsJSON()).toEqual({ type: "number" });
    });

    it("maps AWSJSON to an object, read from a string on input", () => {
      const node = context.document.getNode("AWSJSON") as ScalarNode;
      const hint = node.getDirective("gqlbase_typehint");
      expect(hint).toBeDefined();
      expect(hint?.getArgumentsJSON()).toEqual({ type: "object", input: "string" });
    });

    it("maps string-based scalars to string type hint", () => {
      const stringScalars = [
        "AWSDate",
        "AWSDateTime",
        "AWSTime",
        "AWSEmail",
        "AWSURL",
        "AWSPhone",
        "AWSIPAddress",
      ];

      for (const name of stringScalars) {
        const node = context.document.getNode(name) as ScalarNode;
        const hint = node.getDirective("gqlbase_typehint");
        expect(hint).toBeDefined();
        expect(hint?.getArgumentsJSON()).toEqual({ type: "string" });
      }
    });
  });

  describe("directives", () => {
    it("registers aws_subscribe directive on FIELD_DEFINITION", () => {
      const node = context.document.getNode("aws_subscribe") as DirectiveDefinitionNode;
      expect(node).toBeInstanceOf(DirectiveDefinitionNode);
      expect(node.locations).toEqual(["FIELD_DEFINITION"]);
    });

    it("aws_subscribe has required mutations argument", () => {
      const node = context.document.getNode("aws_subscribe") as DirectiveDefinitionNode;
      expect(node.hasArgument("mutations")).toBe(true);
      const arg = node.getArgument("mutations");
      expect(arg?.type.getTypeName()).toBe("String");
    });

    it("registers aws_auth directive on FIELD_DEFINITION and OBJECT", () => {
      const node = context.document.getNode("aws_auth") as DirectiveDefinitionNode;
      expect(node).toBeInstanceOf(DirectiveDefinitionNode);
      expect(node.locations).toContain("FIELD_DEFINITION");
      expect(node.locations).toContain("OBJECT");
    });

    it("aws_auth has cognito_groups argument", () => {
      const node = context.document.getNode("aws_auth") as DirectiveDefinitionNode;
      expect(node.hasArgument("cognito_groups")).toBe(true);
    });

    it("registers aws_cognito_user_pools directive on FIELD_DEFINITION and OBJECT", () => {
      const node = context.document.getNode("aws_cognito_user_pools") as DirectiveDefinitionNode;
      expect(node).toBeInstanceOf(DirectiveDefinitionNode);
      expect(node.locations).toContain("FIELD_DEFINITION");
      expect(node.locations).toContain("OBJECT");
    });

    it("aws_cognito_user_pools has cognito_groups argument", () => {
      const node = context.document.getNode("aws_cognito_user_pools") as DirectiveDefinitionNode;
      expect(node.hasArgument("cognito_groups")).toBe(true);
    });

    const simpleDirectives = ["aws_api_key", "aws_iam", "aws_oidc", "aws_lambda"];

    it.each(simpleDirectives)(
      "%s is registered on FIELD_DEFINITION and OBJECT with no arguments",
      (name) => {
        const node = context.document.getNode(name) as DirectiveDefinitionNode;
        expect(node).toBeInstanceOf(DirectiveDefinitionNode);
        expect(node.locations).toContain("FIELD_DEFINITION");
        expect(node.locations).toContain("OBJECT");
        expect(node.arguments).toBeUndefined();
      }
    );
  });
});
