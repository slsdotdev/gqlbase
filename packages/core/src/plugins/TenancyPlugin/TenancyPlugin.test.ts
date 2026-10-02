import { beforeAll, describe, expect, it } from "vitest";
import { print } from "graphql";
import { type ITransformerContext } from "../../context/index.js";
import { DefinitionNode, isInputObjectNode, isObjectNode } from "../../definition/index.js";
import { createTransformer } from "../../transformer/index.js";
import { type IPluginFactory } from "../IPluginFactory.js";
import { getScope, type TenancyScope } from "./TenancyPlugin.utils.js";

const tenancy = {
  workspace: { default: true, claims: { workspaceId: "ID" } },
  global: { claims: null },
};

describe("TenancyPlugin", () => {
  describe("claims", () => {
    let schema: string;
    let types: string;

    beforeAll(() => {
      const output = createTransformer({ tenancy }).transform(/* GraphQL */ `
        type Workspace @model @scope(name: global) {
          id: ID!
          invoices: Invoice @hasMany(key: "workspaceId")
        }

        type Invoice @model {
          id: ID!
          number: String!
        }

        type Rate @model @clientOnly {
          id: ID!
        }

        type Note {
          body: String
        }

        type Query {
          note: Note
        }
      `);

      schema = output.files.find((file) => file.path === "schema.graphql")?.content ?? "";
      types = output.files.find((file) => file.path === "schema.types.ts")?.content ?? "";
    });

    it("keeps claims out of the public type, inputs and filters", () => {
      expect(schema).not.toContain("workspaceId");
      expect(types).not.toContain("workspaceId");
    });

    it("removes the directive and the scope enum from the output", () => {
      expect(schema).not.toContain("@scope");
      expect(schema).not.toContain("TenancyScope");
    });
  });

  describe("claim fields", () => {
    // What generators see: the document during `generate`, before cleanup strips the directives.
    let fields: Record<string, Record<string, { type: string; directives: string[] }>>;
    let scopes: Record<string, TenancyScope | null>;
    let createInvoiceInput: string[];

    beforeAll(() => {
      fields = {};
      scopes = {};

      const probe: IPluginFactory = {
        create: (context: ITransformerContext) => ({
          name: "Probe",
          context,
          init: () => undefined,
          match: (definition: DefinitionNode) =>
            isObjectNode(definition) || isInputObjectNode(definition),
          generate: (definition: DefinitionNode) => {
            if (isInputObjectNode(definition) && definition.name === "CreateInvoiceInput") {
              createInvoiceInput = definition.fields?.map((field) => field.name) ?? [];
            }

            if (isObjectNode(definition)) {
              scopes[definition.name] = getScope(definition, context.options);
              fields[definition.name] = Object.fromEntries(
                (definition.fields ?? []).map((field) => [
                  field.name,
                  {
                    type: print(field.type.serialize()),
                    directives: field.directives?.map((directive) => directive.name) ?? [],
                  },
                ])
              );
            }
          },
        }),
      };

      createTransformer({ tenancy, plugins: [probe] }).transform(/* GraphQL */ `
        type Workspace @model @scope(name: global) {
          id: ID!
          invoices: Invoice @hasMany(key: "workspaceId")
        }

        type Invoice @model {
          id: ID!
        }

        type Rate @model @clientOnly {
          id: ID!
        }

        type Account @model {
          id: ID!
          workspaceId: ID! @readOnly
        }
      `);
    });

    it("adds each claim as a non-null @serverOnly field to a model in the default scope", () => {
      expect(fields.Invoice.workspaceId).toEqual({ type: "ID!", directives: ["serverOnly"] });
    });

    it("keeps the claim when a relation keys on it, so it does not become @writeOnly", () => {
      expect(createInvoiceInput).not.toContain("workspaceId");
    });

    it("adds nothing to a model in a scope without claims, or to a @clientOnly model", () => {
      expect(fields.Workspace.workspaceId).toBeUndefined();
      expect(fields.Rate.workspaceId).toBeUndefined();
    });

    it("keeps a claim field the model declares, so it can expose it", () => {
      expect(fields.Account.workspaceId).toEqual({ type: "ID!", directives: ["readOnly"] });
    });

    it("tells generators the scope of each model", () => {
      expect(scopes.Invoice).toEqual({ name: "workspace", claims: { workspaceId: "ID" } });
      expect(scopes.Workspace).toBeNull();
      expect(scopes.Rate).toBeNull();
    });
  });

  describe("errors", () => {
    it("rejects two default scopes", () => {
      expect(() =>
        createTransformer({
          tenancy: {
            a: { default: true, claims: { aId: "ID" } },
            b: { default: true, claims: { bId: "ID" } },
          },
        })
      ).toThrow(/Only one tenancy scope can be the default/);
    });

    it("rejects a scope with an empty claims object", () => {
      expect(() => createTransformer({ tenancy: { a: { claims: {} } } })).toThrow(
        /Use `claims: null`/
      );
    });

    it("rejects a claim with two types", () => {
      expect(() =>
        createTransformer({
          tenancy: { a: { claims: { ownerId: "ID" } }, b: { claims: { ownerId: "String" } } },
        })
      ).toThrow(/Claim ownerId is ID in scope a but String in scope b/);
    });

    it("rejects a scope name that is not a GraphQL enum value", () => {
      expect(() => createTransformer({ tenancy: { "my-scope": { claims: null } } })).toThrow(
        /"my-scope" is not a valid GraphQL enum value/
      );
    });

    it("rejects a claim type that is not a scalar", () => {
      expect(() =>
        createTransformer({
          tenancy: { a: { default: true, claims: { ownerId: "Owner" } } },
        }).transform(/* GraphQL */ `
          type Owner {
            id: ID!
          }

          type Item @model {
            id: ID!
          }
        `)
      ).toThrow(/Claim ownerId of tenancy scope a has type Owner, which is not a scalar/);
    });

    it("rejects @scope on a type that is not stored", () => {
      expect(() =>
        createTransformer({ tenancy }).transform(/* GraphQL */ `
          type Rate @model @clientOnly @scope(name: workspace) {
            id: ID!
          }
        `)
      ).toThrow(/@scope applies to stored models.*Rate is not one/);
    });

    it("rejects a declared claim field with the wrong type or nullability", () => {
      expect(() =>
        createTransformer({ tenancy }).transform(/* GraphQL */ `
          type Invoice @model {
            id: ID!
            workspaceId: String!
          }
        `)
      ).toThrow(/Invoice.workspaceId is the claim of tenancy scope workspace, so it must be ID!/);

      expect(() =>
        createTransformer({ tenancy }).transform(/* GraphQL */ `
          type Invoice @model {
            id: ID!
            workspaceId: ID
          }
        `)
      ).toThrow(/must be ID!/);
    });

    it("does not declare @scope without tenancy", () => {
      expect(() =>
        createTransformer().transform(/* GraphQL */ `
          type Invoice @model @scope(name: workspace) {
            id: ID!
          }
        `)
      ).toThrow(/Unknown directive "@scope"/);
    });
  });
});
