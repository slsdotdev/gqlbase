export const DEFAULT_PAGE_SIZE = 20;

/**
 * Builds a Relay connection from rows fetched with `limit: first + 1`, ordered by `id`. The extra
 * row only tells whether there is a next page; the cursor is the row id (keyset pagination).
 */
export const toConnection = <TNode extends { id: string }>(rows: TNode[], first: number) => {
  const edges = rows.slice(0, first).map((node) => ({ cursor: node.id, node }));

  return {
    edges,
    pageInfo: {
      hasNextPage: rows.length > first,
      hasPreviousPage: false,
      startCursor: edges[0]?.cursor ?? null,
      endCursor: edges.at(-1)?.cursor ?? null,
    },
  };
};
