import { withoutNulls, type WithoutNulls } from "./filter";

export const DEFAULT_PAGE_SIZE = 20;

interface PageArgs {
  first?: number | null;
  after?: string | null;
}

/**
 * Offset pagination: a cursor is the position of its row, so it stays valid under any `orderBy`.
 * The page fetches one extra row, which only tells whether there is a next page.
 */
export const pageOf = (args: PageArgs) => {
  const first = args.first ?? DEFAULT_PAGE_SIZE;
  const offset = args.after ? Number(args.after) : 0;

  return { first, offset, limit: first + 1 };
};

/**
 * Builds a Relay connection from rows fetched with `pageOf(args)`.
 */
export const toConnection = <TNode>(rows: TNode[], first: number, offset: number) => {
  const edges = rows
    .slice(0, first)
    .map((node, index) => ({ cursor: String(offset + index + 1), node }));

  return {
    edges,
    pageInfo: {
      hasNextPage: rows.length > first,
      hasPreviousPage: offset > 0,
      startCursor: edges[0]?.cursor ?? null,
      endCursor: edges.at(-1)?.cursor ?? null,
    },
  };
};

/**
 * The generated `orderBy`, without explicit `null`s, then `id`, so that rows equal on every
 * requested key keep one order across pages. Priority follows the order the input type declares
 * its fields: GraphQL does not keep the client's key order. An `@embedded` field nests its
 * members' directions, which is dsqlbase's `orderBy` for a column group as it is.
 */
export const orderOf = <TOrder extends object>(orderBy: TOrder | null | undefined) => {
  const order: WithoutNulls<TOrder> & { id?: "asc" | "desc" } = withoutNulls(
    orderBy ?? ({} as TOrder)
  );

  order.id ??= "asc";
  return order;
};
