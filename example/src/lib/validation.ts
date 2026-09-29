import { GraphQLError } from "@middy-appsync/graphql";
import * as z from "zod";

export class ValidationError extends GraphQLError {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

/**
 * Parses a value with a generated Zod schema and throws a `ValidationError` the client sees.
 * GraphQL inputs cannot say "optional but not null"; the generated update schemas can
 * (`.optional()` vs `.nullable().optional()`), so resolvers validate with them.
 */
export const validate = <TSchema extends z.ZodType>(schema: TSchema, value: unknown) => {
  const result = schema.safeParse(value);

  if (!result.success) {
    throw new ValidationError(z.prettifyError(result.error));
  }

  return result.data;
};
