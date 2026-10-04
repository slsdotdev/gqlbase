import { beforeAll, describe, expect, it } from "vitest";
import { decodeGlobalId } from "dsqlbase";
import { dsql, migrate } from "../src/lib/dsql";
import { execute } from "./appsync";

const CREATE_CATEGORY = /* GraphQL */ `
  mutation Create($input: CreateCategoryInput!) {
    createCategory(input: $input) {
      id
    }
  }
`;

const CREATE_MEDIA_ASSET = /* GraphQL */ `
  mutation Create($input: CreateMediaAssetInput!) {
    createMediaAsset(input: $input) {
      id
      url
      subjectId
    }
  }
`;

const GET_MEDIA_ASSET = /* GraphQL */ `
  query Get($id: ID!) {
    getMediaAsset(id: $id) {
      url
      subject {
        __typename
        ... on Category {
          id
          categoryName: name
        }
        ... on MarketLocation {
          id
          marketName: name
        }
      }
    }
  }
`;

const CATEGORY_MEDIA = /* GraphQL */ `
  query Get($id: ID!) {
    getCategory(id: $id) {
      media {
        edges {
          node {
            url
          }
        }
      }
    }
  }
`;

interface MediaAssetResult {
  getMediaAsset: {
    url: string;
    subject: { __typename: string; id: string; categoryName?: string; marketName?: string };
  };
}

interface CategoryMediaResult {
  getCategory: { media: { edges: { node: { url: string } }[] } };
}

describe("polymorphic relations", () => {
  const now = new Date().toISOString();
  let categoryId: string;
  let marketId: string;
  let categoryAssetId: string;
  let marketAssetId: string;

  beforeAll(async () => {
    await migrate();

    const category = await execute<{ createCategory: { id: string } }>(CREATE_CATEGORY, {
      variables: { input: { name: "Stone Fruit", slug: "stone-fruit", sortOrder: 1 } },
    });

    categoryId = category.data?.createCategory.id ?? "";

    const market = await dsql.marketLocations.create({
      data: {
        name: "Riverside Market",
        slug: "riverside",
        address: "1 River Road",
        location: { latitude: 0, longitude: 0 },
        amenities: [],
        acceptingVendors: true,
        isArchived: false,
        createdAt: now,
        updatedAt: now,
      },
      return: true as const,
    });

    marketId = market?.id ?? "";

    const categoryAsset = await execute<{ createMediaAsset: { id: string } }>(CREATE_MEDIA_ASSET, {
      variables: { input: { url: "https://cdn.example.com/peach.jpg", subjectId: categoryId } },
    });
    const marketAsset = await execute<{ createMediaAsset: { id: string } }>(CREATE_MEDIA_ASSET, {
      variables: { input: { url: "https://cdn.example.com/river.jpg", subjectId: marketId } },
    });

    categoryAssetId = categoryAsset.data?.createMediaAsset.id ?? "";
    marketAssetId = marketAsset.data?.createMediaAsset.id ?? "";
  });

  it("stores which member a row points at, from the subject's global id", async () => {
    const row = await dsql.mediaAssets.findOne({ where: { id: categoryAssetId } });

    expect(row?.subjectType).toBe("categories");
    expect(row?.subjectId).toBe(categoryId);
  });

  it("resolves the subject to the member the row names", async () => {
    const category = await execute<MediaAssetResult>(GET_MEDIA_ASSET, {
      variables: { id: categoryAssetId },
    });
    const market = await execute<MediaAssetResult>(GET_MEDIA_ASSET, {
      variables: { id: marketAssetId },
    });

    expect(category.errors).toBeUndefined();
    expect(category.data?.getMediaAsset.subject).toEqual({
      __typename: "Category",
      id: categoryId,
      categoryName: "Stone Fruit",
    });
    expect(market.data?.getMediaAsset.subject).toEqual({
      __typename: "MarketLocation",
      id: marketId,
      marketName: "Riverside Market",
    });
  });

  it("lists a member's rows, not another member's row with the same uuid", async () => {
    // Points at a market location whose uuid happens to equal the category's: the pair differs.
    await dsql.mediaAssets.create({
      data: {
        url: "https://cdn.example.com/collision.jpg",
        subjectId: decodeGlobalId(categoryId).pk.id,
        subjectType: "marketLocations",
        createdAt: now,
        updatedAt: now,
      },
    });

    const result = await execute<CategoryMediaResult>(CATEGORY_MEDIA, {
      variables: { id: categoryId },
    });

    expect(result.errors).toBeUndefined();
    expect(result.data?.getCategory.media.edges.map((edge) => edge.node.url)).toEqual([
      "https://cdn.example.com/peach.jpg",
    ]);
  });

  it("rejects a subject that is not a global id", async () => {
    const result = await execute(CREATE_MEDIA_ASSET, {
      variables: {
        input: { url: "https://cdn.example.com/x.jpg", subjectId: decodeGlobalId(marketId).pk.id },
      },
    });

    expect(result.errors?.[0]?.message).toBeDefined();
  });
});
