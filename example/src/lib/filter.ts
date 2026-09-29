/**
 * Generated filter inputs use gqlbase's operator names (`ne`, `le`, `ge`, …); dsqlbase's `where`
 * uses `neq`, `lte`, `gte`. Until the vocabularies are unified, resolvers translate.
 */
const OPERATORS: Record<string, string> = {
  eq: "eq",
  ne: "neq",
  lt: "lt",
  le: "lte",
  gt: "gt",
  ge: "gte",
  in: "in",
  between: "between",
  contains: "contains",
  beginsWith: "beginsWith",
  exists: "exists",
};

type Filter = Record<string, unknown>;

export const toWhere = <TWhere>(filter: Filter | null | undefined): TWhere => {
  const where: Filter = {};
  const and: Filter[] = [];

  for (const [field, value] of Object.entries(filter ?? {})) {
    if (value === null || value === undefined) {
      continue;
    }

    if (field === "and" || field === "or") {
      where[field] = (value as Filter[]).map((item) => toWhere<Filter>(item));
      continue;
    }

    if (field === "not") {
      where.not = toWhere<Filter>(value as Filter);
      continue;
    }

    const condition: Filter = {};

    for (const [operator, operand] of Object.entries(value as Filter)) {
      if (operand === null || operand === undefined) {
        continue;
      }

      if (operator === "notContains") {
        and.push({ not: { [field]: { contains: operand } } });
        continue;
      }

      const mapped = OPERATORS[operator];

      if (!mapped) {
        throw new Error(`Filter operator "${operator}" is not supported`);
      }

      condition[mapped] = operand;
    }

    if (Object.keys(condition).length) {
      where[field] = condition;
    }
  }

  if (and.length) {
    where.and = [...((where.and as Filter[]) ?? []), ...and];
  }

  return where as TWhere;
};

/**
 * Combines `where` conditions, dropping empty ones. dsqlbase 0.1.6 prints invalid SQL for an
 * empty `where` (`{}` or `{ and: [{}] }`), so no condition means no `where` at all.
 */
export const allOf = <TWhere extends object>(
  ...conditions: (TWhere | null | undefined)[]
): TWhere | undefined => {
  const present = conditions.filter(
    (condition): condition is TWhere => !!condition && Object.keys(condition).length > 0
  );

  return present.length ? ({ and: present } as TWhere) : undefined;
};
