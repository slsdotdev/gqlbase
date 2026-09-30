import { beforeAll, describe, expect, it } from "vitest";
import { createTransformer } from "../../transformer/index.js";

describe("ModelPlugin filter inputs", () => {
  let filterInput: string;

  beforeAll(() => {
    const { schema } = createTransformer().transform(/* GraphQL */ `
      type User @model {
        id: ID!
        name: String!
        password: String @writeOnly
        inviteCode: String @writeOnly @filterOnly
      }
    `);

    filterInput = schema.match(/input UserFilterInput \{[^}]*\}/)?.[0] ?? "";
  });

  it("leaves out @writeOnly fields", () => {
    expect(filterInput).toContain("name: StringFilterInput");
    expect(filterInput).not.toContain("password");
  });

  it("keeps a @writeOnly field that is also @filterOnly", () => {
    expect(filterInput).toContain("inviteCode: StringFilterInput");
  });
});
