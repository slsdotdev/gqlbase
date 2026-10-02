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
        createdAt: DateTime @readOnly
        secret: String @serverOnly
        nickname: String @clientOnly
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

  it("keeps @readOnly fields: they are read, not written", () => {
    expect(filterInput).toContain("createdAt: DateTimeFilterInput");
  });

  it("leaves out @serverOnly and @clientOnly fields", () => {
    expect(filterInput).not.toContain("secret");
    expect(filterInput).not.toContain("nickname");
  });

  it("keeps a @writeOnly field that is also @filterOnly", () => {
    expect(filterInput).toContain("inviteCode: StringFilterInput");
  });

  it("adds filter to list<Models>", () => {
    expect(schema).toContain(
      "listUsers(filter: UserFilterInput, orderBy: UserOrderByInput): [User!]"
    );
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
    expect(schema).toContain(
      "members(filter: EmployeeFilterInput, orderBy: EmployeeOrderByInput): [Employee!]"
    );
  });

  it("adds filter on a parent that is not a model", () => {
    expect(schema).toContain(
      "employees(filter: EmployeeFilterInput, orderBy: EmployeeOrderByInput): [Employee!]"
    );
  });

  it("adds filter on a root field", () => {
    expect(schema).toContain(
      "staff(filter: EmployeeFilterInput, orderBy: EmployeeOrderByInput): [Employee!]"
    );
  });

  it("creates the target's filter input without a list operation", () => {
    expect(schema).toContain("input EmployeeFilterInput {");
  });
});

describe("FilterPlugin on object fields", () => {
  let schema: string;

  beforeAll(() => {
    ({ schema } = createTransformer().transform(/* GraphQL */ `
      type PricingModel {
        amount: Float!
        currency: String!
        floor: PricingModel
      }

      interface Media {
        url: String!
      }

      type Image implements Media {
        url: String!
      }

      type Video implements Media {
        url: String!
      }

      union Badge = Image | Video

      type Product @model {
        id: ID!
        pricingModel: PricingModel
        cover: Media
        badge: Badge
        tiers: [PricingModel!]
      }
    `));
  });

  it("filters an object field through exists and where", () => {
    expect(schema).toMatch(
      /input ProductFilterInput \{[^}]*pricingModel: PricingModelFieldFilterInput/
    );
    expect(schema).toMatch(
      /input PricingModelFieldFilterInput \{\s+exists: Boolean\s+where: PricingModelFilterInput\s+\}/
    );
  });

  it("gives the member filter its own and, or and not", () => {
    expect(schema).toMatch(
      /input PricingModelFilterInput \{\s+amount: FloatFilterInput\s+currency: StringFilterInput\s+floor: PricingModelFieldFilterInput\s+and: \[PricingModelFilterInput!\]\s+or: \[PricingModelFilterInput!\]\s+not: PricingModelFilterInput\s+\}/
    );
  });

  it("filters an interface field by its own fields", () => {
    expect(schema).toMatch(
      /input MediaFieldFilterInput \{\s+exists: Boolean\s+where: MediaFilterInput\s+\}/
    );
  });

  it("filters a union field by exists only", () => {
    expect(schema).toMatch(/input BadgeFieldFilterInput \{\s+exists: Boolean\s+\}/);
  });

  it("leaves out lists of objects", () => {
    expect(schema).not.toMatch(/input ProductFilterInput \{[^}]*tiers/);
  });
});

describe("FilterPlugin on dates", () => {
  let schema: string;

  beforeAll(() => {
    ({ schema } = createTransformer().transform(/* GraphQL */ `
      type Entry @model {
        id: ID!
        day: Date
        at: DateTime
        opensAt: Time
        seenAt: Timestamp
      }
    `));
  });

  it("gives date scalars ranges and no substring operators", () => {
    for (const scalar of ["Date", "DateTime", "Time", "Timestamp"]) {
      expect(schema).toMatch(
        new RegExp(
          `input ${scalar}FilterInput \\{\\s+eq: ${scalar}\\s+neq: ${scalar}\\s+lt: ${scalar}\\s+lte: ${scalar}\\s+gt: ${scalar}\\s+gte: ${scalar}\\s+in: \\[${scalar}!\\]\\s+between: \\[${scalar}!\\]\\s+exists: Boolean\\s+\\}`
        )
      );
    }
  });
});

describe("FilterPlugin orderBy", () => {
  let schema: string;

  beforeAll(() => {
    ({ schema } = createTransformer({ relay: true }).transform(/* GraphQL */ `
      enum Status {
        ACTIVE
        INACTIVE
      }

      type Address {
        city: String
      }

      type Product @model {
        id: ID!
        name: String!
        price: Float
        status: Status
        createdAt: DateTime @readOnly
        tags: [String]
        address: Address
        secret: String @serverOnly
        password: String @writeOnly
        reviews: Review @hasMany
      }

      type Review @model {
        id: ID!
        rating: Int!
      }

      type Tag {
        labels: [String]
      }

      type Query {
        tags: Tag @hasMany
      }
    `));
  });

  it("adds a lower-case SortDirection", () => {
    expect(schema).toMatch(/enum SortDirection \{\s+asc\s+desc\s+\}/);
  });

  it("maps every sortable field to SortDirection", () => {
    expect(schema).toMatch(
      /input ProductOrderByInput \{\s+id: SortDirection\s+name: SortDirection\s+price: SortDirection\s+status: SortDirection\s+createdAt: SortDirection\s+\}/
    );
  });

  it("puts orderBy after filter and before the connection arguments", () => {
    expect(schema).toContain(
      "listProducts(filter: ProductFilterInput, orderBy: ProductOrderByInput, first: Int, after: String): ProductConnection!"
    );
    expect(schema).toContain(
      "reviews(filter: ReviewFilterInput, orderBy: ReviewOrderByInput, first: Int, after: String): ReviewConnection!"
    );
  });

  it("adds no orderBy when the target has no sortable field", () => {
    expect(schema).not.toContain("TagOrderByInput");
    expect(schema).toContain("tags(filter: TagFilterInput, first: Int, after: String)");
  });
});
