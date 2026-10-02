import { beforeAll, describe, expect, it } from "vitest";
import { createTransformer } from "../../transformer/index.js";

describe("FilterPlugin filter inputs", () => {
  let schema: string;
  let filterInput: string;

  beforeAll(() => {
    ({ schema } = createTransformer().transform(/* GraphQL */ `
      scalar Tag

      enum Status {
        ACTIVE
        INACTIVE
      }

      type User @model {
        id: ID!
        name: String!
        password: String @writeOnly
        inviteCode: String @writeOnly @filterOnly
        tags: [Tag]
        status: Status
      }
    `));

    filterInput = schema.match(/input UserFilterInput \{[^}]*\}/)?.[0] ?? "";
  });

  it("adds a filter input per enum and per list of a custom scalar", () => {
    expect(filterInput).toContain("status: StatusFilterInput");
    expect(filterInput).toContain("tags: TagListFilterInput");
  });

  it("leaves out @writeOnly fields", () => {
    expect(filterInput).toContain("name: StringFilterInput");
    expect(filterInput).not.toContain("password");
  });

  it("keeps a @writeOnly field that is also @filterOnly", () => {
    expect(filterInput).toContain("inviteCode: StringFilterInput");
  });

  it("adds filter to list<Models>", () => {
    expect(schema).toContain("listUsers(filter: UserFilterInput): [User!]");
  });
});

describe("FilterPlugin on @hasMany", () => {
  let schema: string;

  beforeAll(() => {
    ({ schema } = createTransformer().transform(/* GraphQL */ `
      type Employee @model(operations: [GET]) {
        id: ID!
        name: String!
      }

      type Team @model(operations: [GET]) {
        id: ID!
        members: Employee @hasMany
      }

      type Viewer {
        employees: Employee @hasMany
      }

      type Query {
        viewer: Viewer
        staff: Employee @hasMany
      }
    `));
  });

  it("adds filter on a @model parent", () => {
    expect(schema).toContain("members(filter: EmployeeFilterInput): [Employee!]");
  });

  it("adds filter on a parent that is not a model", () => {
    expect(schema).toContain("employees(filter: EmployeeFilterInput): [Employee!]");
  });

  it("adds filter on a root field", () => {
    expect(schema).toContain("staff(filter: EmployeeFilterInput): [Employee!]");
  });

  it("creates the target's filter input without a list operation", () => {
    expect(schema).toContain("input EmployeeFilterInput {");
  });
});
