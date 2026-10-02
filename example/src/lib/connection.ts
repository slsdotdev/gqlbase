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
 * its fields: GraphQL does not keep the client's key order.
 */
export const orderOf = <TField extends string>(
  orderBy: Partial<Record<TField, "asc" | "desc" | null>> | null | undefined
) => {
  const order: Partial<Record<TField | "id", "asc" | "desc">> = {};

  for (const [field, direction] of Object.entries(orderBy ?? {})) {
    if (direction) {
      order[field as TField] = direction as "asc" | "desc";
    }
  }

  order.id ??= "asc";
  return order;
};
