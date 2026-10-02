import { beforeAll, describe, expect, it } from "vitest";
import ts from "typescript";
import { createTransformer } from "@gqlbase/core";
import { appsyncPreset } from "../appSyncPreset.js";

type Filter = Record<string, unknown>;

interface DynamoDBFilter {
  expression: string;
  expressionNames: Record<string, string>;
  expressionValues: Record<string, unknown>;
}

/**
 * Runs the emitted module in Node. `util` stands in for APPSYNC_JS: `error` throws like
 * `util.error`, and `toMapValues` returns the plain values so they can be compared.
 */
const load = (source: string) => {
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });

  const util = {
    error: (message: string) => {
      throw new Error(message);
    },
    dynamodb: { toMapValues: (values: Record<string, unknown>) => values },
  };

  const exports: Record<string, unknown> = {};
  const require = () => ({ util });
  new Function("exports", "require", outputText)(exports, require);

  return exports.toDynamoDBFilter as (filter: Filter | null) => DynamoDBFilter | null;
};

describe("AppSyncDynamoDBFilterPlugin", () => {
  let source: string | undefined;
  let toDynamoDBFilter: (filter: Filter | null) => DynamoDBFilter | null;

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

  it("returns null for no filter or an empty one", () => {
    expect(toDynamoDBFilter(null)).toBeNull();
    expect(toDynamoDBFilter({})).toBeNull();
    expect(toDynamoDBFilter({ name: { eq: null } })).toBeNull();
  });

  it("maps comparisons", () => {
    const operators = { eq: "=", neq: "<>", lt: "<", lte: "<=", gt: ">", gte: ">=" };

    for (const [operator, symbol] of Object.entries(operators)) {
      expect(toDynamoDBFilter({ price: { [operator]: 5 } })).toEqual({
        expression: `#n0 ${symbol} :v0`,
        expressionNames: { "#n0": "price" },
        expressionValues: { ":v0": 5 },
      });
    }
  });

  it("maps in, between, beginsWith and contains", () => {
    expect(toDynamoDBFilter({ status: { in: ["A", "B"] } })?.expression).toBe("#n0 IN (:v0, :v1)");
    expect(toDynamoDBFilter({ price: { between: [1, 9] } })).toMatchObject({
      expression: "(#n0 BETWEEN :v0 AND :v1)",
      expressionValues: { ":v0": 1, ":v1": 9 },
    });
    expect(toDynamoDBFilter({ name: { beginsWith: "Ap" } })?.expression).toBe(
      "begins_with(#n0, :v0)"
    );
    expect(toDynamoDBFilter({ tags: { contains: "x" } })?.expression).toBe("contains(#n0, :v0)");
  });

  it("treats a null attribute as missing in exists", () => {
    expect(toDynamoDBFilter({ memo: { exists: true } })).toEqual({
      expression: "(attribute_exists(#n0) AND NOT attribute_type(#n0, :v0))",
      expressionNames: { "#n0": "memo" },
      expressionValues: { ":v0": "NULL" },
    });
    expect(toDynamoDBFilter({ memo: { exists: false } })?.expression).toBe(
      "(attribute_not_exists(#n0) OR attribute_type(#n0, :v0))"
    );
  });

  it("joins several operators and fields with AND", () => {
    expect(toDynamoDBFilter({ price: { gte: 1, lt: 9 }, name: { eq: "Kale" } })).toEqual({
      expression: "(#n0 >= :v0 AND #n0 < :v1 AND #n1 = :v2)",
      expressionNames: { "#n0": "price", "#n1": "name" },
      expressionValues: { ":v0": 1, ":v1": 9, ":v2": "Kale" },
    });
  });

  it("filters nested members through where, to any depth", () => {
    expect(
      toDynamoDBFilter({
        status: { eq: "ACTIVE" },
        pricingModel: {
          exists: true,
          where: { amount: { lte: 50 }, floor: { where: { amount: { gt: 1 } } } },
        },
      })
    ).toEqual({
      expression:
        "(#n0 = :v0 AND (attribute_exists(#n1) AND NOT attribute_type(#n1, :v1)) AND (#n1.#n2 <= :v2 AND #n1.#n3.#n2 > :v3))",
      expressionNames: { "#n0": "status", "#n1": "pricingModel", "#n2": "amount", "#n3": "floor" },
      expressionValues: { ":v0": "ACTIVE", ":v1": "NULL", ":v2": 50, ":v3": 1 },
    });
  });

  it("combines and, or and not at depth", () => {
    const result = toDynamoDBFilter({
      or: [
        { name: { eq: "Kale" } },
        { and: [{ price: { lt: 5 } }, { not: { name: { contains: "x" } } }] },
      ],
    });

    expect(result?.expression).toBe("((NOT (contains(#n0, :v2)) AND #n1 < :v1) OR #n0 = :v0)");
    expect(result?.expressionNames).toEqual({ "#n0": "name", "#n1": "price" });
  });

  it("applies and, or and not inside a nested where", () => {
    expect(
      toDynamoDBFilter({ pricingModel: { where: { not: { amount: { gt: 9 } } } } })?.expression
    ).toBe("NOT (#n0.#n1 > :v0)");
  });

  it("rejects endsWith, an empty in and unknown operators through util.error", () => {
    expect(() => toDynamoDBFilter({ name: { endsWith: "s" } })).toThrow(/endsWith/);
    expect(() => toDynamoDBFilter({ name: { in: [] } })).toThrow(/at least one value/);
    expect(() => toDynamoDBFilter({ name: { ge: 1 } })).toThrow(/Unknown filter operator ge/);
  });
});
