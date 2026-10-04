import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTransformer } from "../../transformer/index.js";
import {
  DirectiveDefinitionNode,
  DocumentNode,
  EnumNode,
  InputObjectNode,
  ObjectNode,
} from "../../definition/index.js";
import { ModelPlugin } from "./ModelPlugin.js";
import { TransformerContext } from "../../context/index.js";

const document = DocumentNode.fromSource(/* GraphQL */ `
  scalar Tag

  enum Status {
    ACTIVE
    INACTIVE
  }

  type Model @model {
    id: ID!
    name: String!
    decription: String
    count: Int
    isActive: Boolean
    rating: Float
    tags: [Tag]
    status: Status
  }
`);

const context = new TransformerContext();

const plugin = new ModelPlugin(context);
context.registerPlugin(plugin);

describe("ModelPlugin", () => {
  describe("on init plugin", () => {
    beforeEach(() => {
      context.finishWork();
      context.startWork(document);
    });

    it(`throws if directive already defined`, () => {
      expect(() => plugin.init()).toThrow();
    });

    it(`adds model directive directive definition`, () => {
      expect(context.document.getNode("model")).toBeInstanceOf(DirectiveDefinitionNode);
      expect(context.document.getNode("ModelOperation")).toBeInstanceOf(EnumNode);
    });
  });

  describe("on executing model node", () => {
    beforeEach(() => {
      context.finishWork();
      context.startWork(document);
      plugin.normalize(context.document.getNode("Model") as ObjectNode);
      plugin.execute(context.document.getNode("Model") as ObjectNode);
    });

    it("creates query fields", () => {
      const query = context.document.getQueryNode();

      expect(query.hasField("getModel")).toBeTruthy();
      expect(query.getField("getModel")?.hasArgument("id")).toBeTruthy();
      expect(query.hasField("listModels")).toBeTruthy();
      expect(query.getField("listModels")?.hasDirective("hasMany")).toBeTruthy();
    });

    it("creates mutation fields", () => {
      const mutationNode = context.document.getMutationNode();
      expect(mutationNode.hasField("createModel")).toBeTruthy();
      expect(mutationNode.getField("createModel")?.hasArgument("input")).toBeTruthy();
      expect(mutationNode.getField("createModel")?.type.getTypeName()).toBe("Model");

      expect(mutationNode.hasField("updateModel")).toBeTruthy();
      expect(mutationNode.getField("updateModel")?.hasArgument("input")).toBeTruthy();
      expect(mutationNode.getField("updateModel")?.type.getTypeName()).toBe("Model");

      expect(mutationNode.hasField("deleteModel")).toBeTruthy();
      expect(mutationNode.getField("deleteModel")?.hasArgument("id")).toBeTruthy();
      expect(mutationNode.getField("deleteModel")?.type.getTypeName()).toBe("Model");
    });

    it("creates operation inputs", () => {
      expect(context.document.getNode("CreateModelInput")).toBeInstanceOf(InputObjectNode);
      expect(context.document.getNode("UpdateModelInput")).toBeInstanceOf(InputObjectNode);
    });
  });

  describe("on cleanup nodes", () => {
    beforeEach(() => {
      context.finishWork();
      context.startWork(document);
      plugin.execute(context.document.getNode("Model") as ObjectNode);
      plugin.cleanup(context.document.getNode("Model") as ObjectNode);
    });

    it("removes model node", () => {
      const model = context.document.getNode("Model") as ObjectNode;
      expect(model.hasDirective("model")).toBe(false);
    });
  });

  describe("on run `after` hook", () => {
    beforeEach(() => {
      context.startWork(document);
      plugin.after();
    });

    it("removes `model` directive definition", () => {
      expect(context.document.getNode("model")).toBeUndefined();
      expect(context.document.getNode("ModelOperation")).toBeUndefined();
    });
  });
});

describe("ModelPlugin operations", () => {
  let context: TransformerContext;
  let source: DocumentNode;

  beforeEach(() => {
    context = new TransformerContext({ operations: ["read"] });
    source = DocumentNode.fromSource(/* GraphQL */ `
      type Model @model {
        id: ID!
        name: String!
      }
    `);
  });

  it("uses the transformer's operations option", () => {
    const plugin = new ModelPlugin(context);
    context.registerPlugin(plugin);
    context.startWork(source);
    plugin.normalize(context.document.getNode("Model") as ObjectNode);
    plugin.execute(context.document.getNode("Model") as ObjectNode);

    expect(context.document.getQueryNode().hasField("getModel")).toBe(true);
    expect(context.document.getNode("Mutation")).toBeUndefined();
  });
});

describe("ModelPlugin mutation inputs for a self-referencing object", () => {
  let schema: string;

  beforeAll(() => {
    ({ schema } = createTransformer().transform(/* GraphQL */ `
      type PricingModel {
        amount: Float!
        floor: PricingModel
      }

      type Product @model {
        id: ID!
        pricingModel: PricingModel
      }
    `));
  });

  it("reuses the input for the nested reference", () => {
    expect(schema).toMatch(
      /input PricingModelInput \{\s+amount: Float!\s+floor: PricingModelInput\s+\}/
    );
  });
});

describe("ModelPlugin @embedded", () => {
  it("keeps an embedded type as an object type, without the directive", () => {
    const { schema } = createTransformer().transform(/* GraphQL */ `
      type Money @embedded {
        amount: Float!
        currency: String!
      }

      type Product @model {
        id: ID!
        price: Money
      }
    `);

    expect(schema).toMatch(/type Money \{\s+amount: Float!\s+currency: String!\s+\}/);
    expect(schema).toMatch(/input MoneyInput \{\s+amount: Float!\s+currency: String!\s+\}/);
    expect(schema).not.toContain("embedded");
  });

  it("rejects a type that is both a model and embedded", () => {
    expect(() =>
      createTransformer().transform(/* GraphQL */ `
        type Money @model @embedded {
          id: ID!
          amount: Float!
        }
      `)
    ).toThrow(/cannot be both @model and @embedded/);
  });

  it("rejects an id on an embedded type", () => {
    expect(() =>
      createTransformer().transform(/* GraphQL */ `
        type Money @embedded {
          id: ID!
          amount: Float!
        }
      `)
    ).toThrow(/Money.id cannot be on an @embedded type/);
  });

  it("rejects a relation on an embedded type", () => {
    expect(() =>
      createTransformer().transform(/* GraphQL */ `
        type Vendor @model {
          id: ID!
        }

        type Money @embedded {
          amount: Float!
          vendor: Vendor @belongsTo
        }
      `)
    ).toThrow(/Money.vendor cannot be on an @embedded type/);
  });

  it("rejects an embedded type that contains itself", () => {
    expect(() =>
      createTransformer().transform(/* GraphQL */ `
        type Link @embedded {
          value: Int
          next: Inner
        }

        type Inner @embedded {
          back: Link
        }
      `)
    ).toThrow(/Link > Inner > Link/);
  });

  it("allows a list of itself, which is a document", () => {
    expect(() =>
      createTransformer().transform(/* GraphQL */ `
        type Part @embedded {
          name: String
          parts: [Part]
        }
      `)
    ).not.toThrow();
  });
});
