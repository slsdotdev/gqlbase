import { beforeAll, describe, expect, it } from "vitest";
import { createTransformer } from "@gqlbase/core";
import { appsyncPreset } from "../appSyncPreset.js";

describe("MiddyAppSyncGraphQLPlugin", () => {
  let content: string;

  beforeAll(() => {
    const output = createTransformer({ plugins: [appsyncPreset()] }).transform(/* GraphQL */ `
      enum Visibility {
        PUBLIC
        HIDDEN
      }

      enum Status {
        OPEN
        CLOSED
      }

      type Category @model {
        id: ID!
        name: String!
        status: Status!
        parent: Category @belongsTo
        importRef: String @writeOnly
        deletedAt: AWSDateTime @serverOnly
        visibility: Visibility @serverOnly
        meta: AWSJSON
      }

      type Tag {
        name: String!
      }

      type Query {
        purgeCategories: Int @serverOnly
        search(filter: AWSJSON): [Category!]!
      }
    `);

    content =
      output.files.find((file) => file.path === "appsync/middy-appsync.types.ts")?.content ?? "";
  });

  it("omits @serverOnly operations", () => {
    expect(content).toContain("getCategory: {");
    expect(content).not.toContain("purgeCategories");
  });

  it("omits types that are not in the output schema", () => {
    expect(content).not.toContain("Tag: {");
    expect(content).not.toMatch(/export type Tag\b/);
  });

  it("declares the AppSync version of a type from its own fields and its relations", () => {
    expect(content).toMatch(
      /export type Category = WithTypename<CategoryOwnFields & \{\s+parent\?: Maybe<Category>;\s+\}, "Category">;/
    );
  });

  it("types source as <Type>Source when the type has hidden stored fields", () => {
    expect(content).toMatch(/export type CategorySource = Category & \{/);
    expect(content).toMatch(/parentId\?: Maybe<Scalars\["ID"\]\["output"\]>;/);
    expect(content).toMatch(/importRef\?: Maybe<Scalars\["String"\]\["output"\]>;/);
    expect(content).toMatch(/deletedAt\?: Maybe<Scalars\["AWSDateTime"\]\["output"\]>;/);
    expect(content).toMatch(/parent: \{\s+source: CategorySource;/);
  });

  it("leaves hidden relation fields out of <Type>Source", () => {
    const source = content.match(/export type CategorySource = Category & \{[^}]*\}/)?.[0] ?? "";

    expect(source).toContain("parentId");
    expect(source).not.toMatch(/\bparent\??:/);
  });

  it("declares a hidden field's type locally when the schema types do not export it", () => {
    expect(content).toMatch(/export type Visibility = "PUBLIC" \| "HIDDEN";/);
    expect(content).toMatch(/visibility\?: Maybe<Visibility>;/);
    expect(content).not.toMatch(/import type \{[^}]*\bVisibility\b/);
  });

  it("types arguments with the input side of a scalar", () => {
    expect(content).toMatch(
      /search: \{\s+source: null;\s+args: \{\s+filter\?: Maybe<Scalars\["AWSJSON"\]\["input"\]>;/
    );
  });

  it("re-exports the enums, inputs and scalars it uses, not the parts of objects", () => {
    const reExports = content.match(/export type \{[^}]*\} from "\.\.\/schema\.types";/)?.[0] ?? "";

    expect(reExports).toMatch(/\bScalars\b/);
    expect(reExports).toMatch(/\bStatus\b/);
    expect(reExports).toMatch(/\bCreateCategoryInput\b/);
    expect(reExports).not.toContain("OwnFields");
    expect(content).toMatch(
      /import type \{[^}]*\bCategoryOwnFields\b[^}]*\} from "\.\.\/schema\.types";/
    );
  });

  it("exports the typename and override utilities", () => {
    expect(content).toMatch(
      /export type WithTypename<T, N extends string> = T & \{\s+__typename\?: N;\s+\};/
    );
    expect(content).toMatch(
      /export type WithRequiredTypename<T, N extends string> = T & \{\s+__typename: N;\s+\};/
    );
    expect(content).toContain(
      "export type WithOptional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;"
    );
    expect(content).toContain("export type Override<T, U> = Omit<T, keyof U> & U;");
  });

  describe("tenancy claims", () => {
    let resolverTypes: string;

    beforeAll(() => {
      const output = createTransformer({
        tenancy: { vendor: { claims: { vendorId: "ID" } } },
        plugins: [appsyncPreset()],
      }).transform(/* GraphQL */ `
        type Product @model @scope(name: vendor) {
          id: ID!
          name: String!
          category: Category @belongsTo
        }

        type Category @model {
          id: ID!
        }
      `);

      resolverTypes =
        output.files.find((file) => file.path === "appsync/middy-appsync.types.ts")?.content ?? "";
    });

    it("puts a claim on the resolver's <Type>Source", () => {
      expect(resolverTypes).toMatch(
        /export type ProductSource = Product & \{[^}]*vendorId: Scalars\["ID"\]\["output"\]/
      );
    });
  });

  describe("unions and interfaces", () => {
    let resolverTypes: string;

    beforeAll(() => {
      const output = createTransformer({ plugins: [appsyncPreset()] }).transform(/* GraphQL */ `
        interface Node {
          id: ID!
        }

        type Article implements Node @model {
          id: ID!
          title: String!
        }

        type Video implements Node @model {
          id: ID!
          url: String!
        }

        union FeedItem = Article | Video

        type Feed {
          items: [FeedItem!]!
          cursor: String
        }

        type Query {
          node(id: ID!): Node
          feed: Feed!
        }
      `);

      resolverTypes =
        output.files.find((file) => file.path === "appsync/middy-appsync.types.ts")?.content ?? "";
    });

    it("requires __typename on each member of a union", () => {
      expect(resolverTypes).toContain(
        'export type FeedItem = WithRequiredTypename<Article, "Article"> | WithRequiredTypename<Video, "Video">;'
      );
    });

    it("requires __typename on each type implementing an interface", () => {
      expect(resolverTypes).toContain(
        'export type Node = WithRequiredTypename<Article, "Article"> | WithRequiredTypename<Video, "Video">;'
      );
      expect(resolverTypes).toMatch(/node: \{\s+source: null;[^}]*\};\s+result: Maybe<Node>;/);
    });

    it("overrides an own field that holds a type AppSync changes", () => {
      expect(resolverTypes).toMatch(
        /export type Feed = WithTypename<Override<FeedOwnFields, \{\s+items: FeedItem\[\];\s+\}>, "Feed">;/
      );
      expect(resolverTypes).toMatch(
        /feed: \{\s+source: null;\s+args: Record<string, never>;\s+result: Feed;/
      );
    });

    it("reuses the own fields of a type AppSync does not change", () => {
      expect(resolverTypes).toContain(
        'export type Article = WithTypename<ArticleOwnFields, "Article">;'
      );
    });
  });

  describe("@computed", () => {
    let resolverTypes: string;
    let allTypes: string;
    let files: { path: string; content: string }[];

    const schema = /* GraphQL */ `
      type Report @model {
        id: ID!
        title: String!
        summary: String! @computed
        score: Int! @computed @clientOnly
        author: Author @belongsTo
      }

      type Author @model {
        id: ID!
        name: String!
      }

      type Query {
        latest: [Report!]!
      }
    `;

    beforeAll(() => {
      const output = createTransformer({ plugins: [appsyncPreset()] }).transform(schema);
      const all = createTransformer({
        plugins: [appsyncPreset({ middyAppSync: { resolvers: "all" } })],
      }).transform(schema);

      files = output.files;
      resolverTypes =
        files.find((file) => file.path === "appsync/middy-appsync.types.ts")?.content ?? "";
      allTypes =
        all.files.find((file) => file.path === "appsync/middy-appsync.types.ts")?.content ?? "";
    });

    it("types a computed field, stored or not, next to relations", () => {
      expect(resolverTypes).toMatch(
        /summary: \{\s+source: ReportSource;\s+args: Record<string, never>;\s+result: Scalars\["String"\]\["output"\];/
      );
      expect(resolverTypes).toMatch(/score: \{\s+source: ReportSource;/);
      expect(resolverTypes).toMatch(/author: \{\s+source: ReportSource;/);
      expect(resolverTypes).not.toMatch(/title: \{\s+source:/);
    });

    it("lets the parent's resolver leave computed fields out", () => {
      expect(resolverTypes).toMatch(
        /export type Report = WithTypename<WithOptional<ReportOwnFields, "summary" \| "score"> & \{\s+author\?: Maybe<Author>;\s+\}, "Report">;/
      );
      expect(resolverTypes).toMatch(
        /latest: \{\s+source: null;\s+args: Record<string, never>;\s+result: Report\[\];/
      );
    });

    it("keeps a computed field in the schema, and removes the directive", () => {
      const types = files.find((file) => file.path === "schema.types.ts")?.content;

      expect(types).toMatch(/summary: Scalars\["String"\]\["output"\];/);

      for (const file of files) {
        expect(file.content).not.toContain("computed");
      }
    });

    it("types every public field with resolvers: all, and the same fields stay optional", () => {
      expect(allTypes).toMatch(/title: \{\s+source: ReportSource;/);
      expect(allTypes).toMatch(/WithOptional<ReportOwnFields, "summary" \| "score">/);
    });

    it("throws on an operation field, a relation field or a field outside the public schema", () => {
      const transform = (sdl: string) => () =>
        createTransformer({ plugins: [appsyncPreset()] }).transform(sdl);

      expect(
        transform(/* GraphQL */ `
          type Query {
            stats: Int @computed
          }
        `)
      ).toThrow(/@computed on Query.stats: the field is an operation field/);

      expect(
        transform(/* GraphQL */ `
          type Author @model {
            id: ID!
          }

          type Post @model {
            id: ID!
            author: Author @belongsTo @computed
          }
        `)
      ).toThrow(/@computed on Post.author: the field is a relation field/);

      expect(
        transform(/* GraphQL */ `
          type Post @model {
            id: ID!
            cache: String @serverOnly @computed
          }
        `)
      ).toThrow(/@computed on Post.cache: the field is not in the public schema/);
    });
  });

  it("throws when the schema declares a utility type name", () => {
    expect(() =>
      createTransformer({ plugins: [appsyncPreset()] }).transform(/* GraphQL */ `
        type Override {
          id: ID!
        }

        type Query {
          override: Override
        }
      `)
    ).toThrow(/The schema declares Override, but the AppSync resolver types generate Override/);
  });
});
