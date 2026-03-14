import { GraphQLError } from "graphql";

export class TransformerValidationError extends Error {
  constructor(errors: GraphQLError[]) {
    super(`Schema validation failed.\n\n${errors.map((error) => error.toString()).join("\n\n")}`);
    this.name = "TransformerValidationError";
  }
}

export class InvalidDefinitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidDefinitionError";
  }
}
