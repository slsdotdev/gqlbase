import { beforeAll, describe, expect, it } from "vitest";
import { type ITransformerContext } from "../../context/index.js";
import { DefinitionNode, isObjectNode } from "../../definition/index.js";
import { createTransformer } from "../../transformer/index.js";
import { type IPluginFactory } from "../IPluginFactory.js";
import { getDataSource, isInDataSourceType, type DataSource } from "./DataSourcesPlugin.utils.js";

const dataSources = {
  db: { type: "dsqlbase", default: true },
  integrations: { type: "service" },
};

describe("DataSourcesPlugin", () => {
  describe("output", () => {
    let schema: string;
    let types: string;
    let withoutSourcesSchema: string;
    let withoutSourcesTypes: string;

    beforeAll(() => {
      const source = /* GraphQL */ `
        type Vendor @model {
          id: ID!
          integrations: [Integration!]! @hasMany
        }

        type Integration @model @dataSource(name: integrations) {
          id: ID!
          vendor: Vendor @belongsTo
        }
      `;

      const output = createTransformer({ dataSources }).transform(source);
      const withoutSources = createTransformer().transform(
        source.replace("@dataSource(name: integrations)", "")
      );

      schema = output.files.find((file) => file.path === "schema.graphql")?.content ?? "";
      types = output.files.find((file) => file.path === "schema.types.ts")?.content ?? "";
      withoutSourcesSchema =
        withoutSources.files.find((file) => file.path === "schema.graphql")?.content ?? "";
      withoutSourcesTypes =
        withoutSources.files.find((file) => file.path === "schema.types.ts")?.content ?? "";
    });

    it("removes the directive and the source enum from the output", () => {
      expect(schema).not.toContain("@dataSource");
      expect(schema).not.toContain("DataSource");
    });

    it("changes nothing else: operations, relations and keys are the same in every source", () => {
      expect(schema).toContain("createIntegration(");
      expect(schema).toBe(withoutSourcesSchema);
      expect(types).toBe(withoutSourcesTypes);
    });
  });

  describe("sources", () => {
    // What generators see: the document during `generate`, before cleanup strips the directives.
    let sources: Record<string, DataSource | null>;
    let dsqlbase: Record<string, boolean>;
    let withoutSources: Record<string, boolean>;

    beforeAll(() => {
      sources = {};
      dsqlbase = {};
      withoutSources = {};

      const probe = (target: Record<string, boolean>): IPluginFactory => ({
        create: (context: ITransformerContext) => ({
          name: "Probe",
          context,
          init: () => undefined,
          match: (definition: DefinitionNode) => isObjectNode(definition),
          generate: (definition: DefinitionNode) => {
            if (isObjectNode(definition)) {
              sources[definition.name] = getDataSource(definition, context.options);
              target[definition.name] = isInDataSourceType(definition, context.options, "dsqlbase");
            }
          },
        }),
      });

      const schema = /* GraphQL */ `
        type Vendor @model {
          id: ID!
        }

        type Integration @model @dataSource(name: integrations) {
          id: ID!
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
      `;

      createTransformer({ plugins: [probe(withoutSources)] }).transform(
        schema.replace("@dataSource(name: integrations)", "")
      );
      createTransformer({ dataSources, plugins: [probe(dsqlbase)] }).transform(schema);
    });

    it("puts a model without @dataSource in the default source", () => {
      expect(sources.Vendor).toEqual({ name: "db", type: "dsqlbase" });
    });

    it("puts a model in the source its @dataSource names", () => {
      expect(sources.Integration).toEqual({ name: "integrations", type: "service" });
    });

    it("puts types that are not stored in no source", () => {
      expect(sources.Rate).toBeNull();
      expect(sources.Note).toBeNull();
    });

    it("tells a capability plugin which models are its own", () => {
      expect(dsqlbase).toMatchObject({
        Vendor: true,
        Integration: false,
        Rate: false,
        Note: false,
      });
    });

    it("gives every stored model to every capability plugin when no source is declared", () => {
      expect(withoutSources).toMatchObject({
        Vendor: true,
        Integration: true,
        Rate: false,
        Note: false,
      });
    });
  });

  describe("errors", () => {
    it("rejects two default sources", () => {
      expect(() =>
        createTransformer({
          dataSources: {
            a: { type: "dsqlbase", default: true },
            b: { type: "service", default: true },
          },
        })
      ).toThrow(/Only one data source can be the default; a, b are/);
    });

    it("rejects a source name that is not a GraphQL enum value", () => {
      expect(() => createTransformer({ dataSources: { "my-db": { type: "dsqlbase" } } })).toThrow(
        /Data source "my-db" is not a valid GraphQL enum value/
      );
    });

    it("rejects a source without a type", () => {
      expect(() => createTransformer({ dataSources: { db: { type: "" } } })).toThrow(
        /Data source db has no type/
      );
    });

    it("rejects @dataSource on a type that is not stored", () => {
      expect(() =>
        createTransformer({ dataSources }).transform(/* GraphQL */ `
          type Rate @model @clientOnly @dataSource(name: integrations) {
            id: ID!
          }
        `)
      ).toThrow(/@dataSource applies to stored models.*Rate is not one/);
    });

    it("rejects a stored model in no source", () => {
      expect(() =>
        createTransformer({ dataSources: { db: { type: "dsqlbase" } } }).transform(/* GraphQL */ `
          type Vendor @model {
            id: ID!
          }
        `)
      ).toThrow(/Vendor is in no data source/);
    });

    it("rejects an unknown source name", () => {
      expect(() =>
        createTransformer({ dataSources }).transform(/* GraphQL */ `
          type Vendor @model @dataSource(name: payments) {
            id: ID!
          }
        `)
      ).toThrow(
        /Vendor has @dataSource\(name: payments\), which is not a data source. Declared: db, integrations/
      );
    });

    it("does not declare @dataSource without data sources", () => {
      expect(() =>
        createTransformer().transform(/* GraphQL */ `
          type Vendor @model @dataSource(name: db) {
            id: ID!
          }
        `)
      ).toThrow(/Unknown directive "@dataSource"/);
    });
  });
});
