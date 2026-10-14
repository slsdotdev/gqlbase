import { createPluginFactory } from "../createPluginFactory.js";
import { type ITransformerContext } from "../../context/index.js";
import { TransformerPluginBase } from "../TransformerPluginBase.js";
import {
  ArgumentNode,
  DefinitionNode,
  DirectiveDefinitionNode,
  DirectiveNode,
  FieldNode,
  InputValueNode,
  InterfaceNode,
  isInterfaceNode,
  isObjectNode,
  ListTypeNode,
  NamedTypeNode,
  NonNullTypeNode,
  ObjectNode,
  stripNonNull,
  ValueNode,
} from "../../definition/index.js";
import { isInternal } from "../InternalUtilsPlugin/index.js";
import { RfcDirective } from "./RfcFeaturesPlugin.utils.js";

/**
 * Adds support for features that are in RFC status or draft mode.
 *
 * @see https://github.com/graphql/graphql-wg
 *
 * @definition
 * ```graphql
 * directive `@semanticNonNull(levels: [Int!]! = [0])` on FIELD_DEFINITION
 * ```
 *
 * @example
 * ```graphql
 * type User {
 *   id: ID!
 *   name: String `@semanticNonNull`
 *   tags: [String] `@semanticNonNull(levels: [0, 1])`
 * }
 * ```
 *
 * In the above example, the `name` field is decorated with the `@semanticNonNull` directive, indicating that it is semantically non-nullable. Generators read it through `isSemanticNullable` and treat it as non-null, while the output schema keeps the field nullable, so an error can still null it.
 *
 * Core registers this plugin only when `context.options.semanticNullability` is on. Otherwise the directive is not declared, and a schema that uses it fails validation.
 *
 * With `semanticNullability: "force"`, `cleanup` also turns every non-null field of an object or an interface, except `id`, into a nullable one with `@semanticNonNull` on the levels that were non-null. It runs after `generate`, so generators see the declared types (`isSemanticNullable` reads both the same way) and only the printed schemas change.
 */

export class RfcFeaturesPlugin extends TransformerPluginBase {
  constructor(context: ITransformerContext) {
    super("RfcFeaturesPlugin", context);
  }

  public init() {
    this.context.base.addNode(
      DirectiveDefinitionNode.create(
        "semanticNonNull",
        undefined,
        ["FIELD_DEFINITION"],
        InputValueNode.create(
          "levels",
          undefined,
          undefined,
          NonNullTypeNode.create(
            ListTypeNode.create(NonNullTypeNode.create(NamedTypeNode.create("Int")))
          ),
          ValueNode.list([ValueNode.int(0)])
        )
      )
    );
  }

  public match(definition: DefinitionNode): boolean {
    return (
      this.context.options.semanticNullability === "force" &&
      (isObjectNode(definition) || isInterfaceNode(definition)) &&
      !isInternal(definition)
    );
  }

  public cleanup(definition: ObjectNode | InterfaceNode) {
    for (const field of definition.fields ?? []) {
      this._forceSemanticNonNull(field);
    }
  }

  /**
   * Moves a field's non-null levels into `@semanticNonNull`, merged with the levels it already declares. `id` keeps its
   * `!`: clients such as Relay need it, and every type is converted alike, so implementations still match interfaces.
   */
  private _forceSemanticNonNull(field: FieldNode) {
    if (field.name === "id") {
      return;
    }

    const { type, levels } = stripNonNull(field.type);

    if (!levels.length) {
      return;
    }

    const directive = field.getDirective(RfcDirective.SEMANTIC_NON_NULL);
    const declared = directive
      ? (directive.getArgumentsJSON<{ levels?: number[] }>().levels ?? [0])
      : [];
    const merged = [...new Set([...declared, ...levels])].sort((a, b) => a - b);

    field.setType(type);
    field.removeDirective(RfcDirective.SEMANTIC_NON_NULL);
    field.addDirective(
      DirectiveNode.create(
        RfcDirective.SEMANTIC_NON_NULL,
        merged.length === 1 && merged[0] === 0
          ? undefined
          : [
              ArgumentNode.create(
                "levels",
                ValueNode.list(merged.map((level) => ValueNode.int(level)))
              ),
            ]
      )
    );
  }
}

export const rfcFeaturesPlugin = createPluginFactory(RfcFeaturesPlugin);
