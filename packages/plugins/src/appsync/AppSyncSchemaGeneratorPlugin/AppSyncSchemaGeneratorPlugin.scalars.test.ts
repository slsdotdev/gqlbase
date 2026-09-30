import { beforeAll, describe, expect, it } from "vitest";
import { createTransformer } from "@gqlbase/core";
import { appsyncPreset } from "../index.js";

describe("AppSync scalar mapping", () => {
  let schema: string;

  beforeAll(() => {
    const output = createTransformer({
      plugins: [appsyncPreset({ middyAppSync: { enable: false } })],
    }).transform(/* GraphQL */ `
      type Invoice @model {
        id: ID!
        amount: BigInt!
      }
    `);

    schema = output.files.find((file) => file.path === "appsync/schema.graphql")?.content ?? "";
  });

  it("maps BigInt to Long", () => {
    expect(schema).toMatch(/amount: Long!/);
    expect(schema).not.toMatch(/[:[]\s*BigInt\b/);
  });
});
