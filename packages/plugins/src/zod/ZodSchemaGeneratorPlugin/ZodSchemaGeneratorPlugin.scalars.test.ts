import { beforeAll, describe, expect, it } from "vitest";
import { createTransformer } from "@gqlbase/core";
import { zodSchemaGeneratorPlugin } from "../index.js";

describe("Zod scalar schemas", () => {
  let validators: string;

  beforeAll(() => {
    const output = createTransformer({ plugins: [zodSchemaGeneratorPlugin()] }).transform(
      /* GraphQL */ `
        scalar Counter @gqlbase_typehint(type: bigint)

        type Invoice @model {
          id: ID!
          amount: BigInt!
          views: Counter!
        }
      `
    );

    validators =
      output.files.find((file) => file.path === "zod/schema.validators.ts")?.content ?? "";
  });

  it("validates BigInt as an integer number", () => {
    expect(validators).toMatch(/amount: z\.number\(\)\.int\(\)/);
  });

  it("validates a bigint-hinted scalar as an integer number", () => {
    expect(validators).toMatch(/views: z\.number\(\)\.int\(\)/);
  });
});
