import { beforeAll, describe, expect, it } from "vitest";
import { createTransformer } from "@gqlbase/core";
import { appsyncPreset } from "../appsync/appSyncPreset.js";
import { dsqlbase } from "../dsql/index.js";
import { zodSchemaGeneratorPlugin } from "../zod/index.js";

// A claim is a @serverOnly field: stored and visible to resolvers, never part of the API.
describe("tenancy claims in the generated outputs", () => {
  let tables: string;
  let resolverTypes: string;
  let validators: string;

  beforeAll(() => {
    const output = createTransformer({
      tenancy: { vendor: { claims: { vendorId: "ID" } } },
      plugins: [
        appsyncPreset(),
        zodSchemaGeneratorPlugin({ generateArgumentSchemas: true }),
        dsqlbase(),
      ],
    }).transform(/* GraphQL */ `
      type Product @model @scope(name: vendor) {
        id: ID!
        name: String!
        category: Category @belongsTo
      }

      type Category @model {
        id: ID!
      }
    `);

    const file = (path: string) => output.files.find((f) => f.path === path)?.content ?? "";

    tables = file("dsqlbase/schema.ts");
    resolverTypes = file("appsync/middy-appsync.types.ts");
    validators = file("zod/schema.validators.ts");
  });

  it("is a not-null column of the table", () => {
    expect(tables).toMatch(/vendorId: \w+\("vendor_id"\)\.notNull\(\)/);
  });

  it("is on the resolver's <Type>Source", () => {
    expect(resolverTypes).toMatch(/export type ProductSource = Product & \{[^}]*vendorId: string/);
  });

  it("is not in any Zod schema", () => {
    expect(validators).not.toContain("vendorId");
  });
});
