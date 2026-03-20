import ts from "typescript";
import { createPluginFactory, ITransformerContext, TransformerPluginBase } from "@gqlbase/core";
import { writeOutputFile } from "@gqlbase/shared/files";
import { createFileHeaders } from "@gqlbase/shared/codegen";
import {
  DefinitionNode,
  EnumNode,
  InterfaceNode,
  ListTypeNode,
  NonNullTypeNode,
  ObjectNode,
  TypeNode,
  UnionNode,
} from "@gqlbase/core/definition";
import {
  getBuildinScalarTypeKeyword,
  isNonNullableField,
  isOperationNode,
} from "./ModelTypesGeneratorPlugin.utils.js";
import { isEnum, isObjectLike, isScalar } from "../ModelPlugin/ModelPlugin.utils.js";
import { isRelationField } from "../RelationsPlugin/RelationsPlugin.utils.js";
import { isBuildInScalar } from "@gqlbase/shared/definition";
import { getTypeHint, isInternal } from "@gqlbase/core/plugins";

/**
 * This plugin generates TypeScript types for all objects defined in the schema.
 */

export class ModelTypesGeneratorPlugin extends TransformerPluginBase {
  private nodes: ts.Node[] = [];

  constructor(context: ITransformerContext) {
    super("ModelTypesGeneratorPlugin", context);
  }

  private _getContent() {
    const file = ts.createSourceFile(
      "models.typegen.ts",
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

  private _createTypeNameIdentifier(typeName: string): ts.Identifier {
    if (isBuildInScalar(typeName)) {
      return ts.factory.createIdentifier(getBuildinScalarTypeKeyword(typeName));
    }

    const typeDef = this.context.document.getNodeOrThrow(typeName);

    if (isScalar(typeDef)) {
      const hint = getTypeHint(typeDef);

      switch (hint) {
        case "string":
          return ts.factory.createIdentifier("string");
        case "number":
          return ts.factory.createIdentifier("number");
        case "boolean":
          return ts.factory.createIdentifier("boolean");
        case "id":
          return ts.factory.createIdentifier("string");
        default: {
          this.context.logger.warn(
            `Unknown type hint for scalar ${typeDef.name}. Defaulting to unknown.`
          );
          return ts.factory.createIdentifier("unknown");
        }
      }
    }

    return ts.factory.createIdentifier(typeName);
  }

  private _createValueTypeReference(fieldType: TypeNode): ts.TypeNode {
    if (fieldType instanceof NonNullTypeNode) {
      return this._createValueTypeReference(fieldType.type);
    }

    if (fieldType instanceof ListTypeNode) {
      const elementType = this._createValueTypeReference(fieldType.type);
      return ts.factory.createArrayTypeNode(elementType);
    }

    return ts.factory.createTypeReferenceNode(this._createTypeNameIdentifier(fieldType.name));
  }

  private _createFieldMembers(definition: ObjectNode | InterfaceNode) {
    const members: ts.TypeElement[] = [];

    for (const field of definition.fields ?? []) {
      if (isRelationField(field)) {
        continue;
      }

      const questionToken = isNonNullableField(field)
        ? undefined
        : ts.factory.createToken(ts.SyntaxKind.QuestionToken);

      const typeNode = isNonNullableField(field)
        ? this._createValueTypeReference(field.type)
        : ts.factory.createTypeReferenceNode("Maybe", [this._createValueTypeReference(field.type)]);

      const propertySignature = ts.factory.createPropertySignature(
        [ts.factory.createModifier(ts.SyntaxKind.ReadonlyKeyword)],
        ts.factory.createIdentifier(field.name),
        questionToken,
        typeNode
      );

      // ts.addSyntheticLeadingComment(
      //   propertySignature,
      //   ts.SyntaxKind.MultiLineCommentTrivia,
      //   `* ${field.name ?? ""} `,
      //   /*hasTrailingNewLine*/ true
      // );

      members.push(propertySignature);
    }

    return members;
  }

  private _createObjectType(definition: ObjectNode) {
    const members = this._createFieldMembers(definition);

    const objectType = ts.factory.createTypeAliasDeclaration(
      /*modifiers*/ [ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)],
      ts.factory.createIdentifier(definition.name),
      /*typeParameters*/ undefined,
      ts.factory.createTypeLiteralNode(members)
    );

    this.nodes.push(objectType);
  }

  private _createInterfaceType(definition: InterfaceNode) {
    const members = this._createFieldMembers(definition);

    const interfaceType = ts.factory.createInterfaceDeclaration(
      /*modifiers*/ [ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)],
      ts.factory.createIdentifier(definition.name),
      /*typeParameters*/ undefined,
      /*heritageClauses*/ undefined,
      members
    );

    this.nodes.push(interfaceType);
  }

  private _createEnumType(definition: EnumNode) {
    if (!definition.values?.length) {
      this.context.logger.warn(
        `Enum type ${definition.name} does not have any values. Skipping type generation.`
      );
      return;
    }

    const members = definition.values.map((value) =>
      ts.factory.createLiteralTypeNode(ts.factory.createStringLiteral(value.name))
    );

    const enumType = ts.factory.createTypeAliasDeclaration(
      /*modifiers*/ [ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)],
      ts.factory.createIdentifier(definition.name),
      /*typeParameters*/ undefined,
      ts.factory.createUnionTypeNode(members)
    );

    this.nodes.push(enumType);
  }

  private _createUnionType(definition: UnionNode) {
    if (!definition.types?.length) {
      this.context.logger.warn(
        `Union type ${definition.name} does not have any member types. Skipping type generation.`
      );
      return;
    }

    const refs = definition.types.map((type) =>
      ts.factory.createTypeReferenceNode(ts.factory.createIdentifier(type.name))
    );

    const unionType = ts.factory.createTypeAliasDeclaration(
      /*modifiers*/ [ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)],
      ts.factory.createIdentifier(definition.name),
      /*typeParameters*/ undefined,
      ts.factory.createUnionTypeNode(refs)
    );

    this.nodes.push(unionType);
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
      )
    );
  }

  public match(definition: DefinitionNode): boolean {
    return (
      (isObjectLike(definition) || isEnum(definition)) &&
      !isOperationNode(definition) &&
      !isInternal(definition)
    );
  }

  public generate(definition: DefinitionNode) {
    if (definition instanceof InterfaceNode) {
      return this._createInterfaceType(definition);
    }

    if (definition instanceof ObjectNode) {
      return this._createObjectType(definition);
    }

    if (definition instanceof UnionNode) {
      return this._createUnionType(definition);
    }

    if (definition instanceof EnumNode) {
      return this._createEnumType(definition);
    }
  }

  public output() {
    const content = this._getContent();
    writeOutputFile(this.context.outputDirectory, "models.typegen.ts", content);

    return {};
  }
}

export const modelTypesGeneratorPlugin = createPluginFactory(ModelTypesGeneratorPlugin);
