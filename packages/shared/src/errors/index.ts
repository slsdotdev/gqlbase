import { GraphQLError } from "graphql";

export class TransformerValidationError extends Error {
  constructor(errors: readonly GraphQLError[]) {
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

export class TransformerPluginExecutionError extends Error {
  constructor(pluginName: string, message: string) {
    super(`Error in plugin ${pluginName}: ${message}`);
    this.name = "TransformerPluginExecutionError";
  }
}
