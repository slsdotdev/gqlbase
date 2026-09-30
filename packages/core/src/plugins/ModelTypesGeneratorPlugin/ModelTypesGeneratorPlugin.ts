import ts from "typescript";
import { createPluginFactory } from "../createPluginFactory.js";
import { type ITransformerContext } from "../../context/index.js";
import { createFileHeaders } from "@gqlbase/shared/codegen";
import {
  DefinitionNode,
  InterfaceNode,
  isDirectiveDefinitionNode,
  isEnumNode,
  isInputObjectNode,
  isInterfaceNode,
  isObjectNode,
  isOperationNode,
  isScalarNode,
  isUnionNode,
  ObjectNode,
} from "../../definition/index.js";
import {
  mergeOptions,
  ModelTypesGeneratorPluginOptions,
} from "./ModelTypesGeneratorPlugin.utils.js";
import { isRelationField } from "../RelationsPlugin/RelationsPlugin.utils.js";
import { isInternal } from "../InternalUtilsPlugin/index.js";
import { isSemanticNullable } from "../RfcFeaturesPlugin/RfcFeaturesPlugin.utils.js";
import { TypesGeneratorBase } from "../TypesGeneratorBase/TypesGeneratorBase.js";
import { isServerOnly, isWriteOnly } from "../UtilitiesPlugin/UtilitiesPlugin.utils.js";

/**
 * This plugin generates TypeScript types for all objects defined in the schema.
 */

export class ModelTypesGeneratorPlugin extends TypesGeneratorBase {
  private nodes: ts.Node[] = [];
  private options: Required<ModelTypesGeneratorPluginOptions>;

  constructor(context: ITransformerContext, options: ModelTypesGeneratorPluginOptions = {}) {
    super("ModelTypesGeneratorPlugin", context);

    this.options = mergeOptions(options);
  }

  private _getContent() {
    const file = ts.createSourceFile(
      this.options.fileName,
      /*sourceText*/ "",
      ts.ScriptTarget.Latest,
      /*setParentNodes*/ false,
      ts.ScriptKind.TS
    );

    const printer = ts.createPrinter({
      newLine: ts.NewLineKind.CarriageReturnLineFeed,
      removeComments: false,
    });

    return printer.printList(ts.ListFormat.MultiLine, ts.factory.createNodeArray(this.nodes), file);
  }

  protected _createFieldMembers(definition: ObjectNode | InterfaceNode) {
    const members: ts.TypeElement[] = [];

    for (const field of definition.fields ?? []) {
      if (isInternal(field) || (isWriteOnly(field) && !isServerOnly(field))) {
        continue;
      }

      const questionToken =
        isSemanticNullable(field) || isRelationField(field)
          ? ts.factory.createToken(ts.SyntaxKind.QuestionToken)
          : undefined;

      const typeNode = this._createValueTypeReference(field, field.type);

      const propertySignature = ts.factory.createPropertySignature(
        undefined,
        ts.factory.createIdentifier(field.name),
        questionToken,
        typeNode
      );

      // TODO: consider adding JSDoc comments with field descriptions and deprecation notices
      // ts.addSyntheticLeadingComment(
      //   propertySignature,
      //   ts.SyntaxKind.MultiLineCommentTrivia,
      //   `* ${field.name ?? ""} `,
      //   /*hasTrailingNewLine*/ true
      // );

      members.push(propertySignature);
    }

    if (isObjectNode(definition)) {
      members.push(
        ts.factory.createPropertySignature(
          undefined,
          ts.factory.createIdentifier("__typename"),
          ts.factory.createToken(ts.SyntaxKind.QuestionToken),
          ts.factory.createLiteralTypeNode(ts.factory.createStringLiteral(definition.name))
        )
      );
    }

    return members;
  }

  public before() {
    const headers = createFileHeaders();

    this.nodes = [...headers];

    this.nodes.push(
      ts.factory.createTypeAliasDeclaration(
        /*modifiers*/ [ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)],
        ts.factory.createIdentifier("Maybe"),
        [ts.factory.createTypeParameterDeclaration(undefined, "T")],
        ts.factory.createUnionTypeNode([
          ts.factory.createTypeReferenceNode("T"),
          ts.factory.createLiteralTypeNode(ts.factory.createNull()),
        ])
      ),
      ts.factory.createTypeAliasDeclaration(
        undefined,
        ts.factory.createIdentifier("RequiredTypename"),
        [
          ts.factory.createTypeParameterDeclaration(
            undefined,
            ts.factory.createIdentifier("T"),
            ts.factory.createTypeLiteralNode([
              ts.factory.createPropertySignature(
                undefined,
                ts.factory.createIdentifier("__typename"),
                ts.factory.createToken(ts.SyntaxKind.QuestionToken),
                ts.factory.createKeywordTypeNode(ts.SyntaxKind.StringKeyword)
              ),
            ]),
            undefined
          ),
        ],
        ts.factory.createIntersectionTypeNode([
          ts.factory.createTypeReferenceNode(ts.factory.createIdentifier("T"), undefined),
          ts.factory.createTypeLiteralNode([
            ts.factory.createPropertySignature(
              undefined,
              ts.factory.createIdentifier("__typename"),
              undefined,
              ts.factory.createKeywordTypeNode(ts.SyntaxKind.StringKeyword)
            ),
          ]),
        ])
      )
    );
  }

  public match(definition: DefinitionNode): boolean {
    return (
      !isOperationNode(definition) &&
      !isInternal(definition) &&
      !isScalarNode(definition) &&
      !isDirectiveDefinitionNode(definition)
    );
  }

  public generate(definition: DefinitionNode) {
    if (isInterfaceNode(definition)) {
      return this.nodes.push(this._createInterfaceType(definition));
    }

    if (isObjectNode(definition)) {
      return this.nodes.push(this._createObjectType(definition));
    }

    if (isUnionNode(definition)) {
      return this.nodes.push(this._createUnionType(definition));
    }

    if (isInputObjectNode(definition)) {
      return this.nodes.push(this._createInputObjectType(definition));
    }

    if (isEnumNode(definition)) {
      return this.nodes.push(this._createEnumType(definition));
    }
  }

  public output() {
    const content = this._getContent();

    this.context.files.push({
      type: "ts",
      path: this.options.fileName,
      filename: this.options.fileName,
      content,
    });

    return this.options.emitOutput ? { modelTypes: content } : {};
  }
}

export const modelTypesGeneratorPlugin = createPluginFactory(ModelTypesGeneratorPlugin);
