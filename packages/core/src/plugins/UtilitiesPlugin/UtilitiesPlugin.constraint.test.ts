import { beforeAll, describe, expect, it } from "vitest";
import { createTransformer } from "../../transformer/index.js";

describe("@constraint cleanup", () => {
  let schema: string;

  beforeAll(() => {
    ({ schema } = createTransformer().transform(/* GraphQL */ `
      input SearchInput {
        term: String @constraint(min: 2)
      }

      type Post @model {
        id: ID!
        title: String! @constraint(max: 120)
      }

      type Query {
        search(input: SearchInput, limit: Int @constraint(max: 50)): [Post!]
      }
    `));
  });

  it("removes it from object fields, input fields and arguments", () => {
    expect(schema).not.toContain("@constraint");
    expect(schema).toMatch(/input SearchInput \{\s+term: String\s+\}/);
    expect(schema).toContain("search(input: SearchInput, limit: Int): [Post!]");
  });
});
