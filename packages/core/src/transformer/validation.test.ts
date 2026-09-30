import { beforeAll, describe, expect, it } from "vitest";
import { TransformerValidationError } from "@gqlbase/shared/errors";
import { createTransformer } from "./createTransformer.js";
import type { ITransformerContext } from "../context/index.js";

describe("validation stages", () => {
  describe("a source that references generated types", () => {
    let schema: string;

    beforeAll(() => {
      ({ schema } = createTransformer({ relay: true }).transform(/* GraphQL */ `
        type Post @model {
          id: ID!
          title: String!
        }

        input PostSearchInput {
          title: StringFilterInput
          post: PostFilterInput
        }

        type Query {
          searchPosts(where: PostSearchInput): PostConnection!
        }
      `));
    });

    it("transforms", () => {
      expect(schema).toContain("searchPosts(where: PostSearchInput): PostConnection!");
      expect(schema).toMatch(
        /input PostSearchInput \{\s+title: StringFilterInput\s+post: PostFilterInput\s+\}/
      );
    });
  });

  describe("an override of a generated type", () => {
    let schema: string;

    beforeAll(() => {
      ({ schema } = createTransformer().transform(/* GraphQL */ `
        input StringFilterInput {
          eq: String
        }

        type Post @model {
          id: ID!
          title: String!
        }
      `));
    });

    it("is used as declared", () => {
      expect(schema).toMatch(/input StringFilterInput \{\s+eq: String\s+\}/);
    });
  });

  describe("an unknown type", () => {
    let generated: boolean;
    let error: unknown;

    beforeAll(() => {
      generated = false;

      try {
        createTransformer({
          plugins: [
            {
              create: (context: ITransformerContext) => ({
                name: "GenerateProbePlugin",
                context,
                init: () => undefined,
                match: () => true,
                generate: () => {
                  generated = true;
                },
              }),
            },
          ],
        }).transform(/* GraphQL */ `
          type Post @model {
            id: ID!
            title: StrngFilterInput
          }
        `);
      } catch (caught) {
        error = caught;
      }
    });

    it("fails validation", () => {
      expect(error).toBeInstanceOf(TransformerValidationError);
      expect(String(error)).toMatch(/Unknown type "StrngFilterInput"/);
    });

    it("fails before generate", () => {
      expect(generated).toBe(false);
    });
  });

  describe("an unknown directive", () => {
    it("still fails before any plugin runs", () => {
      expect(() =>
        createTransformer().transform(/* GraphQL */ `
          type Post @unknown {
            id: ID!
          }
        `)
      ).toThrow(TransformerValidationError);
    });
  });

  describe("an unknown relation target", () => {
    it("is reported by validation, not by a plugin", () => {
      expect(() =>
        createTransformer({ relay: true }).transform(/* GraphQL */ `
          type Post @model {
            id: ID!
            author: Autor @belongsTo
            tags: Tg @hasMany
          }
        `)
      ).toThrow(/Unknown type "Autor"[\s\S]*Unknown type "Tg"/);
    });
  });

  describe("a relation to a built-in scalar", () => {
    it("still throws", () => {
      expect(() =>
        createTransformer().transform(/* GraphQL */ `
          type Post @model {
            id: ID!
            owner: Int @belongsTo
          }
        `)
      ).toThrow(/Int is not a valid relationship target for Post.owner/);
    });
  });

  describe("an extension of an undeclared root type", () => {
    let schema: string;

    beforeAll(() => {
      ({ schema } = createTransformer().transform(/* GraphQL */ `
        type Post @model {
          id: ID!
        }

        extend type Mutation {
          publishPost(id: ID!): Post
        }
      `));
    });

    it("merges with the operations plugins generate", () => {
      expect(schema).toMatch(/type Mutation \{[^}]*publishPost\(id: ID!\): Post[^}]*createPost\(/);
    });
  });
});
