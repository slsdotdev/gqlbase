import { Kind } from "graphql";
import type { TenancyScopeOptions, TransformerOptions } from "../../context/index.js";
import { ObjectNode } from "../../definition/index.js";
import { isModel } from "../ModelPlugin/index.js";
import { isClientOnly } from "../UtilitiesPlugin/index.js";

export const TenancyDirective = {
  SCOPE: "scope",
} as const;

/** The enum of scope names, generated from `options.tenancy`. */
export const TENANCY_SCOPE_ENUM = "TenancyScope";

export interface TenancyScope {
  name: string;
  claims: Readonly<Record<string, string>>;
}

/**
 * Whether a model is stored, so it can carry claims: a `@model` that is not `@clientOnly`.
 */
export const isScopeable = (node: ObjectNode): boolean => {
  return isModel(node) && !isClientOnly(node);
};

/**
 * The scope a model is in and its claims: the one named by `@scope(name:)`, or the default scope. `null` for a model in
 * no scope or in a scope without claims, and for a type that is not stored.
 *
 * Reads the `@scope` directive, so call it before `cleanup` (generators run before cleanup).
 */
export const getScope = (
  node: ObjectNode,
  options: Readonly<Pick<TransformerOptions, "tenancy">>
): TenancyScope | null => {
  if (!isScopeable(node)) {
    return null;
  }

  const value = node.getDirective(TenancyDirective.SCOPE)?.getArgument("name")?.value;
  const entries = Object.entries(options.tenancy);
  const [name, scope] =
    value?.kind === Kind.ENUM
      ? (entries.find(([key]) => key === value.value) ?? [])
      : (entries.find(([, candidate]) => candidate.default) ?? []);

  if (!name || !scope?.claims) {
    return null;
  }

  return { name, claims: scope.claims };
};

/**
 * The problems with a tenancy config, as messages. Types are checked against the document later.
 */
export const validateTenancyOptions = (
  tenancy: Readonly<Record<string, TenancyScopeOptions>>
): string[] => {
  const errors: string[] = [];
  const claimTypes = new Map<string, { type: string; scope: string }>();
  const defaults = Object.keys(tenancy).filter((name) => tenancy[name].default);

  if (defaults.length > 1) {
    errors.push(`Only one tenancy scope can be the default; ${defaults.join(", ")} are.`);
  }

  for (const [name, scope] of Object.entries(tenancy)) {
    if (!/^[_A-Za-z][_0-9A-Za-z]*$/.test(name) || ["true", "false", "null"].includes(name)) {
      errors.push(`Tenancy scope "${name}" is not a valid GraphQL enum value.`);
    }

    if (scope.claims === null) {
      continue;
    }

    if (Object.keys(scope.claims).length === 0) {
      errors.push(
        `Tenancy scope ${name} has no claims. Use \`claims: null\` for a scope without claims.`
      );
    }

    for (const [claim, type] of Object.entries(scope.claims)) {
      const other = claimTypes.get(claim);

      if (other && other.type !== type) {
        errors.push(
          `Claim ${claim} is ${other.type} in scope ${other.scope} but ${type} in scope ${name}. A claim has one type.`
        );
      }

      claimTypes.set(claim, { type, scope: name });
    }
  }

  return errors;
};
