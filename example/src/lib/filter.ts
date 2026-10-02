type Filter = Record<string, unknown>;

/**
 * Generated filter inputs use dsqlbase's operator names. GraphQL passes an omitted operand as
 * absent but an explicit one as `null`; dsqlbase reads `null` as a value, so it is dropped here.
 */
export const toWhere = <TWhere>(filter: Filter | null | undefined): TWhere => {
  const where: Filter = {};

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
      if (operand !== null && operand !== undefined) {
        condition[operator] = operand;
      }
    }

    if (Object.keys(condition).length) {
      where[field] = condition;
    }
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
