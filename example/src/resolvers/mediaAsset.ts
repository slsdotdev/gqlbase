import {
  createMutationResolver,
  createQueryResolver,
  createResolver,
  defineResolvers,
  GraphQLError,
} from "@middy-appsync/graphql";
import { decodeGlobalId } from "dsqlbase";
import { dsql } from "../lib/dsql";
import { pageOf, toConnection } from "../lib/connection";
import { validate } from "../lib/validation";
import { CreateMediaAssetInputSchema } from "../../generated/zod/schema.validators";
import type { MediaSubject } from "../../generated/appsync/middy-appsync.types";

// MediaAsset.subject is a @belongsTo to the MediaSubject union. The client sends the subject's global id, which names
// its member; the hidden subjectType is that member's alias.

const getMediaAsset = createQueryResolver({
  fieldName: "getMediaAsset",
  resolve: async ({ args }) => {
    return await dsql.mediaAssets.findOne({ where: { id: args.id } });
  },
});

const createMediaAsset = createMutationResolver({
  fieldName: "createMediaAsset",
  resolve: async ({ args }) => {
    const input = validate(CreateMediaAssetInputSchema, args.input);
    const now = new Date().toISOString();

    // dsqlbase fills the discriminator from a global id at runtime, but its create type still requires it.
    const subjectType = decodeGlobalId(input.subjectId).key as "categories" | "marketLocations";

    return await dsql.mediaAssets.create({
      data: { ...input, subjectType, createdAt: now, updatedAt: now },
      return: true as const,
    });
  },
});

// Through the generated relation: the join reads only the member the discriminator names.
const mediaAssetSubject = createResolver({
  typeName: "MediaAsset",
  fieldName: "subject",
  resolve: async ({ source }) => {
    const asset = await dsql.mediaAssets.findOne({
      where: { id: source.id },
      join: { subject: true },
    });
    const subject = asset?.subject;

    if (!subject) {
      throw new GraphQLError(`MediaAsset ${source.id} has no subject.`);
    }

    // A union row's `__typename` comes from its member's meta; the spread does not narrow the row union.
    return { ...subject, __typename: subject.$$meta.__typename } as MediaSubject;
  },
});

// A member's reverse relation. Filtering by the parent's global id matches the discriminator too, so a row pointing
// at another member with the same uuid is not listed.
const mediaOf = (typeName: "Category" | "MarketLocation") =>
  createResolver({
    typeName,
    fieldName: "media",
    resolve: async ({ source, args }) => {
      const { first, offset, limit } = pageOf(args);
      const rows = await dsql.mediaAssets.findMany({
        where: { subjectId: { eq: source.id } },
        orderBy: { createdAt: "asc", id: "asc" },
        limit,
        offset,
      });

      return toConnection(rows, first, offset);
    },
  });

export default defineResolvers(
  getMediaAsset,
  createMediaAsset,
  mediaAssetSubject,
  mediaOf("Category"),
  mediaOf("MarketLocation")
);
