/**
 * `T` without `null` at any depth.
 */
export type WithoutNulls<T> = T extends readonly unknown[]
  ? { [K in keyof T]: WithoutNulls<Exclude<T[K], null>> }
  : T extends object
    ? { [K in keyof T]: WithoutNulls<Exclude<T[K], null>> }
    : Exclude<T, null>;

/**
 * Generated filters use dsqlbase's operators, so a filter is a dsqlbase `where` as it is (see
 * `test/where.types.ts`). The only difference is GraphQL's explicit `null`: an omitted operand is
 * absent, an explicit one is `null`, which dsqlbase would read as a value. Drop them, and the
 * conditions they leave empty: dsqlbase 0.1.6 prints invalid SQL for an empty condition.
 */
export const withoutNulls = <T>(value: T): WithoutNulls<T> => {
  if (Array.isArray(value)) {
    return value
      .map((item: unknown) => withoutNulls(item))
      .filter((item) => !isEmptyObject(item)) as WithoutNulls<T>;
  }

  if (value === null || typeof value !== "object") {
    return value as WithoutNulls<T>;
  }

  const result: Record<string, unknown> = {};

  for (const [key, item] of Object.entries(value)) {
    const kept = item === null || item === undefined ? undefined : withoutNulls(item);

    if (kept !== undefined && !isEmptyObject(kept)) {
      result[key] = kept;
    }
  }

  return result as WithoutNulls<T>;
};

const isEmptyObject = (value: unknown) =>
  typeof value === "object" &&
  value !== null &&
  !Array.isArray(value) &&
  Object.keys(value).length === 0;

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
