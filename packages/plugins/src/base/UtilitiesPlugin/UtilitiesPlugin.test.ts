import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { TransformerContext } from "@gqlbase/core";
import { DefinitionNode, DocumentNode, ObjectNode } from "@gqlbase/core/definition";
import { UtilitiesPlugin } from "./UtilitiesPlugin.js";
import { UtilityDirective } from "./UtilitiesPlugin.utils.js";

describe("UtilitiesPlugin", () => {
  let plugin: UtilitiesPlugin;
  let context: TransformerContext;

  beforeAll(() => {
    context = new TransformerContext();
    plugin = new UtilitiesPlugin(context);
    context.registerPlugin(plugin);
  });

  beforeEach(() => {
    context.finishWork();
    context.startWork(
      DocumentNode.fromSource(/* GraphQL */ `
        type User {
          id: ID!
          username: String!
          password: String! @writeOnly
          secret: String! @serverOnly
          clientData: String! @clientOnly
          filterField: String! @filterOnly
          createOnlyField: String! @createOnly
          updateOnlyField: String! @updateOnly
          readOnlyField: String! @readOnly
        }

        type Query {
          me: User
        }
      `)
    );
  });

  it("adds utility directive definitions", () => {
    expect(context.document.getNode(UtilityDirective.READ_ONLY)).toBeDefined();
    expect(context.document.getNode(UtilityDirective.WRITE_ONLY)).toBeDefined();
    expect(context.document.getNode(UtilityDirective.SERVER_ONLY)).toBeDefined();
    expect(context.document.getNode(UtilityDirective.CLIENT_ONLY)).toBeDefined();
    expect(context.document.getNode(UtilityDirective.FILTER_ONLY)).toBeDefined();
    expect(context.document.getNode(UtilityDirective.CREATE_ONLY)).toBeDefined();
    expect(context.document.getNode(UtilityDirective.UPDATE_ONLY)).toBeDefined();
  });

  it("matches object and interface nodes", () => {
    const objectNode = context.document.getNode("User") as ObjectNode;
    const directiveNode = context.document.getNode("serverOnly") as DefinitionNode;

    expect(plugin.match(objectNode)).toBeTruthy();
    expect(plugin.match(directiveNode)).toBeFalsy();
  });

  it("cleans un fields with utility directives", () => {
    const userNode = context.document.getNode("User") as ObjectNode;
    plugin.cleanup(userNode);

    expect(userNode.hasField("password")).toBeFalsy();
    expect(userNode.hasField("secret")).toBeFalsy();
    expect(userNode.hasField("clientData")).toBeTruthy();
    expect(userNode.hasField("filterField")).toBeFalsy();
    expect(userNode.hasField("createOnlyField")).toBeFalsy();
    expect(userNode.hasField("updateOnlyField")).toBeFalsy();
    expect(userNode.hasField("readOnlyField")).toBeTruthy();
  });

  it("removes utility directive definitions on after hook", () => {
    plugin.after();

    expect(context.document.getNode(UtilityDirective.READ_ONLY)).toBeUndefined();
    expect(context.document.getNode(UtilityDirective.WRITE_ONLY)).toBeUndefined();
    expect(context.document.getNode(UtilityDirective.SERVER_ONLY)).toBeUndefined();
    expect(context.document.getNode(UtilityDirective.CLIENT_ONLY)).toBeUndefined();
    expect(context.document.getNode(UtilityDirective.FILTER_ONLY)).toBeUndefined();
    expect(context.document.getNode(UtilityDirective.CREATE_ONLY)).toBeUndefined();
    expect(context.document.getNode(UtilityDirective.UPDATE_ONLY)).toBeUndefined();
  });
});
