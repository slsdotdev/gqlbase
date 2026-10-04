import { beforeAll, describe, expect, it } from "vitest";
import ts from "typescript";
import { createTransformer } from "@gqlbase/core";
import { appsyncPreset } from "../appSyncPreset.js";

type Filter = Record<string, unknown>;

/**
 * Runs the emitted module in Node. `util` stands in for APPSYNC_JS: `error` throws like
 * `util.error`, and `toDynamoDBFilterExpression` echoes its input, so a test sees exactly what
 * AppSync's helper would receive.
 */
const load = (source: string) => {
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });

  const util = {
    error: (message: string) => {
      throw new Error(message);
    },
    transform: { toDynamoDBFilterExpression: (filter: unknown) => JSON.stringify(filter) },
  };

  const exports: Record<string, unknown> = {};
  const require = () => ({ util });
  new Function("exports", "require", outputText)(exports, require);

  return exports.toDynamoDBFilter as (filter: Filter | null) => unknown;
};

describe("AppSyncDynamoDBFilterPlugin", () => {
  let source: string | undefined;
  let toDynamoDBFilter: (filter: Filter | null) => unknown;

  beforeAll(() => {
    const output = createTransformer({
      plugins: [appsyncPreset({ dynamoDBFilter: true, middyAppSync: { enable: false } })],
    }).transform(/* GraphQL */ `
      type Product @model {
        id: ID!
        name: String
      }
    `);

    source = output.files.find((file) => file.path === "appsync/dynamodb-filter.ts")?.content;
    toDynamoDBFilter = load(source ?? "");
  });

  it("emits appsync/dynamodb-filter.ts importing util from @aws-appsync/utils", () => {
    expect(source).toContain('import { util } from "@aws-appsync/utils";');
  });

  it("is not emitted unless asked for", () => {
    const output = createTransformer({ plugins: [appsyncPreset()] }).transform(/* GraphQL */ `
      type Product @model {
        id: ID!
      }
    `);

    expect(output.files.map((file) => file.path)).not.toContain("appsync/dynamodb-filter.ts");
  });

  it("returns null for no filter or one left empty", () => {
    expect(toDynamoDBFilter(null)).toBeNull();
    expect(toDynamoDBFilter({})).toBeNull();
    expect(toDynamoDBFilter({ name: { eq: null } })).toBeNull();
    expect(toDynamoDBFilter({ pricingModel: { where: { amount: { lte: 5 } } } })).toBeNull();
  });

  it("renames operators to AppSync's", () => {
    expect(
      toDynamoDBFilter({
        price: { neq: 1, lte: 9, gte: 2, eq: 3, lt: 8, gt: 0 },
        memo: { exists: true },
      })
    ).toEqual({
      price: { ne: 1, le: 9, ge: 2, eq: 3, lt: 8, gt: 0 },
      memo: { attributeExists: true },
    });
  });

  it("keeps in, between, beginsWith and contains", () => {
    const filter = {
      status: { in: ["A", "B"] },
      price: { between: [1, 9] },
      name: { beginsWith: "Ap", contains: "p" },
    };

    expect(toDynamoDBFilter(filter)).toEqual(filter);
  });

  it("renames inside and, or and not at any depth", () => {
    expect(
      toDynamoDBFilter({
        or: [
          { name: { neq: "Kale" } },
          { and: [{ price: { gte: 5 } }, { not: { price: { lte: 9 } } }] },
        ],
      })
    ).toEqual({
      or: [
        { name: { ne: "Kale" } },
        { and: [{ price: { ge: 5 } }, { not: { price: { le: 9 } } }] },
      ],
    });
  });

  it("does not rename fields named like an operator", () => {
    expect(toDynamoDBFilter({ exists: { eq: true }, neq: { gte: 1 } })).toEqual({
      exists: { eq: true },
      neq: { ge: 1 },
    });
  });

  it("drops nested where conditions, keeping exists on the object", () => {
    expect(
      toDynamoDBFilter({
        pricingModel: {
          where: { amount: { lte: 50 }, and: [{ currency: { eq: "EUR" } }] },
          exists: true,
        },
        status: { eq: "ACTIVE" },
      })
    ).toEqual({ pricingModel: { attributeExists: true }, status: { eq: "ACTIVE" } });

    expect(
      toDynamoDBFilter({
        and: [
          { cover: { exists: false, where: { url: { beginsWith: "s3" } } } },
          { name: { eq: "Kale" } },
        ],
      })
    ).toEqual({ and: [{ cover: { attributeExists: false } }, { name: { eq: "Kale" } }] });
  });

  it("drops explicit nulls, and the conditions they leave empty", () => {
    expect(
      toDynamoDBFilter({ name: { eq: null, neq: "x" }, price: { lt: null }, not: null, memo: null })
    ).toEqual({ name: { ne: "x" } });
  });

  it("keeps strings that look like JSON or operators", () => {
    const filter = { name: { eq: '{"where":{"neq":1}}', contains: 'say "hi", \\ :null' } };
    expect(toDynamoDBFilter(filter)).toEqual(filter);
  });

  it("sends a list's contains with one item as that item", () => {
    expect(
      toDynamoDBFilter({ tags: { contains: ["local"], exists: true }, ids: { contains: [3] } })
    ).toEqual({ tags: { contains: "local", attributeExists: true }, ids: { contains: 3 } });
  });

  it("drops a list's contains with no items", () => {
    expect(toDynamoDBFilter({ tags: { contains: [] }, name: { eq: "Kale" } })).toEqual({
      name: { eq: "Kale" },
    });
  });

  it("rejects a list's contains with several items through util.error", () => {
    expect(() => toDynamoDBFilter({ tags: { contains: ["local", "organic"] } })).toThrow(
      /contains takes one item/
    );
  });

  it("rejects endsWith through util.error", () => {
    expect(() => toDynamoDBFilter({ name: { endsWith: "s" } })).toThrow(/endsWith/);
  });
});
