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

      type Category @model {
        id: ID!
        name: String!
        parent: Category @belongsTo
        importRef: String @writeOnly
        deletedAt: AWSDateTime @serverOnly
        visibility: Visibility @serverOnly
      }

      type Tag {
        name: String!
      }

      type Query {
        purgeCategories: Int @serverOnly
      }
    `);

    content =
      output.files.find((file) => file.path === "appsync/middy-appsync.typegen.ts")?.content ?? "";
  });

  it("omits @serverOnly operations", () => {
    expect(content).toContain("getCategory: {");
    expect(content).not.toContain("purgeCategories");
  });

  it("omits types that are not in the output schema", () => {
    expect(content).not.toContain("Tag: {");
  });

  it("types source as <Type>Source when the type has hidden stored fields", () => {
    expect(content).toMatch(/export type CategorySource = Category & \{/);
    expect(content).toMatch(/parentId\?: Maybe<string>;/);
    expect(content).toMatch(/importRef\?: Maybe<string>;/);
    expect(content).toMatch(/deletedAt\?: Maybe<string>;/);
    expect(content).toMatch(/parent: \{\s+source: CategorySource;/);
  });

  it("types a hidden field whose type is not public as unknown", () => {
    expect(content).toMatch(/visibility\?: unknown;/);
    expect(content).not.toMatch(/import type \{[^}]*\bVisibility\b/);
  });
});
