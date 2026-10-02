/**
 * Compile-time checks, run by `tsc` (`npm run typecheck`): a generated filter, once explicit
 * `null`s are dropped, is a dsqlbase `where`, and a generated `orderBy` is a dsqlbase `orderBy`.
 * No translation sits between them.
 */
import type { dsql } from "../src/lib/dsql";
import type { WithoutNulls } from "../src/lib/filter";
import type {
  CategoryFilterInput,
  CategoryOrderByInput,
  LedgerEntryFilterInput,
  LedgerEntryOrderByInput,
} from "../generated/schema.types";

type CategoryArgs = NonNullable<Parameters<typeof dsql.categories.findMany>[0]>;
type LedgerEntryArgs = NonNullable<Parameters<typeof dsql.ledgerEntries.findMany>[0]>;

export const categoryWhere = (
  filter: WithoutNulls<CategoryFilterInput>
): CategoryArgs["where"] => filter;

export const categoryOrderBy = (
  orderBy: WithoutNulls<CategoryOrderByInput>
): CategoryArgs["orderBy"] => orderBy;

export const ledgerEntryWhere = (
  filter: WithoutNulls<LedgerEntryFilterInput>
): LedgerEntryArgs["where"] => filter;

export const ledgerEntryOrderBy = (
  orderBy: WithoutNulls<LedgerEntryOrderByInput>
): LedgerEntryArgs["orderBy"] => orderBy;
