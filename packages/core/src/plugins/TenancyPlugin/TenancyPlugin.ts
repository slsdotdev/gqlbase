import { isBuildInScalar } from "@gqlbase/shared/definition";
import { TransformerPluginExecutionError } from "@gqlbase/shared/errors";
import { type ITransformerContext } from "../../context/index.js";
import {
  DefinitionNode,
  DirectiveDefinitionNode,
  DirectiveNode,
  EnumNode,
  FieldNode,
  InputValueNode,
  isListTypeNode,
  isObjectNode,
  isScalarNode,
  NonNullTypeNode,
  ObjectNode,
} from "../../definition/index.js";
import { createPluginFactory } from "../createPluginFactory.js";
import { TransformerPluginBase } from "../TransformerPluginBase.js";
import { InternalDirective } from "../InternalUtilsPlugin/index.js";
import { isSemanticNullable } from "../RfcFeaturesPlugin/index.js";
import { UtilityDirective } from "../UtilitiesPlugin/index.js";
import {
  getScope,
  isScopeable,
  TENANCY_SCOPE_ENUM,
  TenancyDirective,
  validateTenancyOptions,
} from "./TenancyPlugin.utils.js";

/**
 * Tenancy: puts stored models in a scope, and adds the scope's claims to them as `@serverOnly` fields. The ORM fills a
 * claim from the caller's identity, so it is never part of the API. Core registers this plugin only when
 * `context.options.tenancy` declares a scope.
 *
 * @definition
 * ```graphql
 * enum TenancyScope { workspace global }   # the keys of options.tenancy
 * directive `@scope(name: TenancyScope!)` on OBJECT
 * ```
 *
 * @example
 * ```graphql
 * # tenancy: { workspace: { default: true, claims: { workspaceId: "ID" } }, global: { claims: null } }
 *
 * # Before
 * type Invoice `@model` { id: ID! }
 * type Currency `@model` `@scope(name: global)` { id: ID! }
 *
 * # After
 * type Invoice `@model` { id: ID!, workspaceId: ID! `@serverOnly` }
 * type Currency `@model` { id: ID! }
 * ```
 *
 * A model that declares a field named like a claim keeps it as declared, so it can expose it
 * (`workspaceId: ID! @readOnly`). It must have the claim's type and be non-null.
 */
export class TenancyPlugin extends TransformerPluginBase {
  constructor(context: ITransformerContext) {
    super("TenancyPlugin", context);

    const errors = validateTenancyOptions(context.options.tenancy);

    if (errors.length) {
      throw new TransformerPluginExecutionError(this.name, errors.join("\n"));
    }
  }

  public init() {
    this.context.base
      .addNode(
        EnumNode.create(
          TENANCY_SCOPE_ENUM,
          undefined,
          [DirectiveNode.create(InternalDirective.INTERNAL)],
          Object.keys(this.context.options.tenancy)
        )
      )
      .addNode(
        DirectiveDefinitionNode.create(
          TenancyDirective.SCOPE,
          undefined,
          ["OBJECT"],
          [
            InputValueNode.create(
              "name",
              undefined,
              undefined,
              NonNullTypeNode.create(TENANCY_SCOPE_ENUM)
            ),
          ]
        )
      );
  }

  private _checkClaimTypes() {
    for (const [name, scope] of Object.entries(this.context.options.tenancy)) {
      for (const [claim, type] of Object.entries(scope.claims ?? {})) {
        const node = this.context.document.getNode(type);

        if (!isBuildInScalar(type) && !(node && isScalarNode(node))) {
          throw new TransformerPluginExecutionError(
            this.name,
            `Claim ${claim} of tenancy scope ${name} has type ${type}, which is not a scalar.`
          );
        }
      }
    }
  }

  private _addClaims(model: ObjectNode) {
    const scope = getScope(model, this.context.options);

    for (const [claim, type] of Object.entries(scope?.claims ?? {})) {
      const field = model.getField(claim);

      if (!field) {
        model.addField(
          FieldNode.create(
            claim,
            undefined,
            [DirectiveNode.create(UtilityDirective.SERVER_ONLY)],
            NonNullTypeNode.create(type)
          )
        );
        continue;
      }

      // Declared by the model, for example to expose it: kept, but it must hold the claim.
      if (
        isListTypeNode(field.type) ||
        field.type.getTypeName() !== type ||
        isSemanticNullable(field)
      ) {
        throw new TransformerPluginExecutionError(
          this.name,
          `${model.name}.${claim} is the claim of tenancy scope ${scope?.name}, so it must be ${type}!.`
        );
      }
    }
  }

  /**
   * Claims are added here, before any plugin's `normalize`: relations add their keys while normalizing other types (a
   * `@hasMany` keys its target), and an existing claim field must win over a `@writeOnly` relation key.
   */
  public before() {
    this._checkClaimTypes();

    for (const definition of this.context.document.definitions.values()) {
      if (!isObjectNode(definition)) {
        continue;
      }

      if (definition.hasDirective(TenancyDirective.SCOPE) && !isScopeable(definition)) {
        throw new TransformerPluginExecutionError(
          this.name,
          `@scope applies to stored models, a @model that is not @clientOnly. ${definition.name} is not one.`
        );
      }

      if (isScopeable(definition)) {
        this._addClaims(definition);
      }
    }
  }

  public match(definition: DefinitionNode): boolean {
    return isObjectNode(definition) && definition.hasDirective(TenancyDirective.SCOPE);
  }

  public cleanup(definition: ObjectNode) {
    definition.removeDirective(TenancyDirective.SCOPE);
  }

  public after() {
    this.context.document.removeNode(TenancyDirective.SCOPE).removeNode(TENANCY_SCOPE_ENUM);
  }
}

export const tenancyPlugin = createPluginFactory(TenancyPlugin);
