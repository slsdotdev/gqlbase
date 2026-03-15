import { ITransformerPlugin } from "@gqlbase/core";
import type { ITransformerContext } from "@gqlbase/core/context";
import {
  DefinitionNode,
  DirectiveDefinitionNode,
  DirectiveNode,
  EnumNode,
  FieldNode,
  InputObjectNode,
  InputValueNode,
  ListTypeNode,
  NamedTypeNode,
  NonNullTypeNode,
  ObjectNode,
  ScalarNode,
} from "@gqlbase/core/definition";
import { createPluginFactory, InternalDirective } from "@gqlbase/core/plugins";
import { TransformerPluginExecutionError } from "@gqlbase/shared/errors";
import { camelCase, pascalCase, pluralize } from "@gqlbase/shared/format";

export const ModelDirective = {
  MODEL: "model",
} as const;

export const ModelOperation = {
  GET: "get",
  LIST: "list",
  SYNC: "sync",
  SUBSCRIBE: "subscribe",
  CREATE: "create",
  UPDATE: "update",
  UPSERT: "upsert",
  DELETE: "delete",
  READ: "read",
  WRITE: "write",
} as const;

type OperationType = (typeof ModelOperation)[keyof typeof ModelOperation];

export const DEFAULT_READ_OPERATIONS: OperationType[] = ["get", "list"];
export const DEFAULT_WRITE_OPERATIONS: OperationType[] = ["create", "update", "delete"];

export const isModel = (definition: DefinitionNode): definition is ObjectNode => {
  return definition instanceof ObjectNode && definition.hasDirective(ModelDirective.MODEL);
};

export interface ModelPluginOptions {
  operations: OperationType[];
}

export class ModelPlugin implements ITransformerPlugin {
  public readonly name = "ModelPlugin";
  readonly context: ITransformerContext;
  private _defaultOperations: OperationType[];

  constructor(
    context: ITransformerContext,
    options: ModelPluginOptions = { operations: ["read", "write"] }
  ) {
    this.context = context;

    this._defaultOperations = this._expandOperations(options.operations);
  }

  // #region Operations

  private _expandOperations(operations: OperationType[]) {
    const expandedOperations = new Set<OperationType>();

    for (const operation of operations) {
      if (operation === "read") {
        DEFAULT_READ_OPERATIONS.forEach((op) => expandedOperations.add(op));
      } else if (operation === "write") {
        DEFAULT_WRITE_OPERATIONS.forEach((op) => expandedOperations.add(op));
      } else {
        expandedOperations.add(operation);
      }
    }

    return Array.from(expandedOperations);
  }

  private _getOperationNames(object: ObjectNode) {
    const directive = object.getDirective("model");

    if (!directive) {
      throw new TransformerPluginExecutionError(
        this.name,
        `@model directive not found for type ${object.name}`
      );
    }

    const args = directive.getArgumentsJSON<{ operations?: OperationType[] }>();

    if (args.operations && args.operations.length > 0) {
      return this._expandOperations(args.operations);
    }

    return this._defaultOperations;
  }

  private _createGetQuery(model: ObjectNode) {
    const fieldName = camelCase("get", model.name);
    const queryNode = this.context.document.getQueryNode();

    // We allow users to implement custom definition for fields.
    // So, if the field already exists, we skip creating it.
    if (!queryNode.hasField(fieldName)) {
      const field = FieldNode.create(
        fieldName,
        NamedTypeNode.create(model.name),
        [InputValueNode.create("id", NonNullTypeNode.create("ID"))],
        [DirectiveNode.create("hasOne")]
      );

      queryNode.addField(field);
    }
  }

  private _createListQuery(model: ObjectNode) {
    const fieldName = camelCase("list", pluralize(model.name));
    const queryNode = this.context.document.getQueryNode();

    if (!queryNode.hasField(fieldName)) {
      const field = FieldNode.create(fieldName, NamedTypeNode.create(model.name), null, [
        DirectiveNode.create("hasMany"),
      ]);

      queryNode.addField(field);
    }
  }

  private _shouldSkipFieldFromMutationInput(field: FieldNode) {
    return (
      field.hasDirective("readOnly") ||
      field.hasDirective("serverOnly") ||
      field.hasDirective("clientOnly") ||
      field.hasDirective("hasOne") ||
      field.hasDirective("hasMany")
    );
  }

  private _isBuildInScalarType(typeName: string) {
    return ["ID", "String", "Int", "Float", "Boolean"].includes(typeName);
  }

  /**
   * For each field in the model
   * 1. If has `@readOnly` or connection directives - skip
   * 2. If scalar or enum - add to input;
   * 3. If union - skip;
   * 4. If object or interface - check definition;
   *    4.1 If `@model` - skip;
   *    4.2 If implements `Node` interface - skip
   *    4.3 If fields are `@readOnly` - skip;
   */

  private _createMutationInput(
    model: ObjectNode,
    inputName: string,
    requiredFields: string[] = []
  ) {
    const input = InputObjectNode.create(inputName);

    if (inputName.startsWith("Delete")) {
      input.addField(
        InputValueNode.create("id", NonNullTypeNode.create(NamedTypeNode.create("ID")))
      );
    } else {
      for (const field of model.fields ?? []) {
        if (this._shouldSkipFieldFromMutationInput(field)) {
          continue;
        }

        const fieldTypeName = field.type.getTypeName();

        if (requiredFields.includes(field.name)) {
          input.addField(InputValueNode.create(field.name, NonNullTypeNode.create(fieldTypeName)));
          continue;
        }

        // Buildin scalars
        if (this._isBuildInScalarType(fieldTypeName)) {
          input.addField(InputValueNode.create(field.name, NamedTypeNode.create(fieldTypeName)));
          continue;
        }

        const typeDef = this.context.document.getNode(fieldTypeName);

        if (!typeDef) {
          throw new TransformerPluginExecutionError(this.name, `Unknown type ${fieldTypeName}`);
        }

        if (typeDef instanceof ScalarNode || typeDef instanceof EnumNode) {
          input.addField(InputValueNode.create(field.name, NamedTypeNode.create(fieldTypeName)));
          continue;
        }

        if (typeDef instanceof ObjectNode) {
          if (
            typeDef.hasDirective("model") ||
            typeDef.hasDirective("readOnly") ||
            typeDef.hasDirective("serverOnly") ||
            typeDef.hasDirective("clientOnly") ||
            typeDef.hasInterface("Node")
          ) {
            continue;
          }

          const inputName = pascalCase(fieldTypeName, "input");

          if (!this.context.document.hasNode(inputName)) {
            this._createMutationInput(typeDef, inputName);
          }

          input.addField(InputValueNode.create(field.name, NamedTypeNode.create(inputName)));
        }
      }
    }

    this.context.document.addNode(input);
  }

  private _createDeleteMutationField(model: ObjectNode, fieldName: string) {
    const mutationNode = this.context.document.getMutationNode();

    if (!mutationNode.hasField(fieldName)) {
      const field = FieldNode.create(fieldName, NamedTypeNode.create(model.name), [
        InputValueNode.create("id", NonNullTypeNode.create(NamedTypeNode.create("ID"))),
      ]);

      mutationNode.addField(field);
    }
  }

  private _createMutationField(
    model: ObjectNode,
    fieldName: string,
    inputName: string,
    requiredFields?: string[]
  ) {
    const mutationNode = this.context.document.getMutationNode();

    if (!this.context.document.getNode(inputName)) {
      this._createMutationInput(model, inputName, requiredFields);
    }

    if (!mutationNode.hasField(fieldName)) {
      const field = FieldNode.create(fieldName, NamedTypeNode.create(model.name), [
        InputValueNode.create("input", NonNullTypeNode.create(NamedTypeNode.create(inputName))),
      ]);

      mutationNode.addField(field);
    }
  }

  private _createMutation(model: ObjectNode, verb: OperationType) {
    const fieldName = camelCase(verb, model.name);
    const inputName = pascalCase(verb, model.name, "input");

    if (verb === "delete") {
      this._createDeleteMutationField(model, fieldName);
    } else if (verb === "update") {
      this._createMutationField(model, fieldName, inputName, ["id"]);
    } else {
      this._createMutationField(model, fieldName, inputName);
    }
  }

  // #endregion Operations

  public init() {
    this.context.base
      .addNode(
        EnumNode.create("ModelOperation", Object.values(ModelOperation), [
          DirectiveNode.create(InternalDirective.INTERNAL),
        ])
      )
      .addNode(
        DirectiveDefinitionNode.create(
          "model",
          ["OBJECT"],
          [
            InputValueNode.create(
              "operations",
              ListTypeNode.create(NonNullTypeNode.create("ModelOperation"))
            ),
          ]
        )
      );
  }

  public match(definition: DefinitionNode) {
    return isModel(definition);
  }

  public execute(definition: ObjectNode) {
    // 1. Add operation fields
    const operations = this._getOperationNames(definition);

    for (const verb of operations) {
      switch (verb) {
        case "get":
          this._createGetQuery(definition);
          break;
        case "list":
          this._createListQuery(definition);
          break;
        case "create":
        case "upsert":
        case "update":
        case "delete":
          this._createMutation(definition, verb);
          break;
        default:
          continue;
      }
    }
  }

  public cleanup(definition: ObjectNode): void {
    definition.removeDirective(ModelDirective.MODEL);
  }

  public after(): void {
    this.context.document.removeNode(ModelDirective.MODEL).removeNode("ModelOperation");
  }
}

export const modelPlugin = createPluginFactory(ModelPlugin);
