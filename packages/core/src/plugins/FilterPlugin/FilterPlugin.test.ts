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
        labels: [String]
        status: Status
        age: Int
        active: Boolean
      }
    `));

    filterInput = schema.match(/input UserFilterInput \{[^}]*\}/)?.[0] ?? "";
  });

  it("adds a filter input per enum", () => {
    expect(filterInput).toContain("status: StatusFilterInput");
    expect(schema).toMatch(
      /input StatusFilterInput \{\s+eq: Status\s+neq: Status\s+in: \[Status!\]\s+exists: Boolean\s+\}/
    );
  });

  it("uses the operator names for strings", () => {
    const input = schema.match(/input StringFilterInput \{[^}]*\}/)?.[0] ?? "";
    const operators = [...input.matchAll(/^\s+(\w+):/gm)].map((match) => match[1]);

    expect(operators).toEqual([
      "eq",
      "neq",
      "lt",
      "lte",
      "gt",
      "gte",
      "in",
      "between",
      "beginsWith",
      "endsWith",
      "contains",
      "exists",
    ]);
  });

  it("uses the operator names for numbers and booleans", () => {
    expect(schema).toMatch(
      /input IntFilterInput \{\s+eq: Int\s+neq: Int\s+lt: Int\s+lte: Int\s+gt: Int\s+gte: Int\s+in: \[Int!\]\s+between: \[Int!\]\s+exists: Boolean\s+\}/
    );
    expect(schema).toMatch(
      /input BooleanFilterInput \{\s+eq: Boolean\s+neq: Boolean\s+exists: Boolean\s+\}/
    );
  });

  it("gives every list of scalars or enums a list filter", () => {
    expect(filterInput).toContain("tags: TagListFilterInput");
    expect(filterInput).toContain("labels: StringListFilterInput");
    expect(schema).toMatch(
      /input StringListFilterInput \{\s+contains: String\s+exists: Boolean\s+\}/
    );
  });

  it("drops size and notContains", () => {
    expect(schema).not.toContain("SizeFilterInput");
    expect(schema).not.toContain("notContains");
  });

  it("types and, or and not with the filter itself", () => {
    expect(filterInput).toContain("and: [UserFilterInput!]");
    expect(filterInput).toContain("or: [UserFilterInput!]");
    expect(filterInput).toContain("not: UserFilterInput");
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
