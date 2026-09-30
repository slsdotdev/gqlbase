import { beforeAll, describe, expect, it } from "vitest";
import { createTransformer } from "@gqlbase/core";
import { drizzleSchemaGeneratorPlugin } from "../index.js";

describe("Drizzle BigInt columns", () => {
  let tables: string;

  beforeAll(() => {
    const output = createTransformer({
      plugins: [drizzleSchemaGeneratorPlugin({ emitOutput: true })],
    }).transform(/* GraphQL */ `
      type Invoice @model {
        id: ID!
        amount: BigInt!
      }
    `);

    tables = String(output.drizzleSchema ?? "");
  });

  it("uses a bigint column in number mode", () => {
    expect(tables).toContain('amount: bigint("amount", { mode: "number" }).notNull()');
  });
});
