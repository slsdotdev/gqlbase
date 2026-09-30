import ts from "typescript";
import { TransformerPluginBase } from "../TransformerPluginBase.js";
import { isBuildInScalar } from "@gqlbase/shared/definition";
import { getTypeHint } from "../InternalUtilsPlugin/index.js";
import {
  EnumNode,
  FieldNode,
  InputObjectNode,
  InputValueNode,
  InterfaceNode,
  isNullableTypeNode,
  isScalarNode,
  ListTypeNode,
  NonNullTypeNode,
  ObjectNode,
  TypeNode,
  UnionNode,
} from "../../definition/index.js";
import { isSemanticNullable } from "../RfcFeaturesPlugin/index.js";
import { isRelationField } from "../RelationsPlugin/index.js";
import { TransformerPluginExecutionError } from "@gqlbase/shared/errors";

export abstract class TypesGeneratorBase extends TransformerPluginBase {
  protected _createTypeNameIdentifier(typeName: string): ts.Identifier {
    if (isBuildInScalar(typeName)) {
      switch (typeName) {
        case "ID":
        case "String":
          return ts.factory.createIdentifier("string");
        case "Int":
        case "Float":
          return ts.factory.createIdentifier("number");
        case "Boolean":
          return ts.factory.createIdentifier("boolean");
      }
    }

    const typeDef = this.context.document.getNodeOrThrow(typeName);

    if (isScalarNode(typeDef)) {
      const hint = getTypeHint(typeDef);

      switch (hint) {
        case "id":
          return ts.factory.createIdentifier("string");
        case "string":
          return ts.factory.createIdentifier("string");
        case "number":
          return ts.factory.createIdentifier("number");
        case "boolean":
          return ts.factory.createIdentifier("boolean");
        case "object":
          return ts.factory.createIdentifier("Record<string, unknown>");
        case "unknown":
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

  protected _createValueTypeReference(
    field: FieldNode,
    fieldType: TypeNode,
    level = 0
  ): ts.TypeNode {
    if (fieldType instanceof NonNullTypeNode) {
      return this._createValueTypeReference(field, fieldType.type, level);
    }

    if (fieldType instanceof ListTypeNode) {
      const elementType = this._createValueTypeReference(field, fieldType.type, level + 1);
      const arrayType = ts.factory.createArrayTypeNode(elementType);

      return isSemanticNullable(field, level)
        ? ts.factory.createTypeReferenceNode("Maybe", [arrayType])
        : arrayType;
    }

    const baseType = ts.factory.createTypeReferenceNode(
      this._createTypeNameIdentifier(fieldType.name)
    );

    return isSemanticNullable(field, level)
      ? ts.factory.createTypeReferenceNode("Maybe", [baseType])
      : baseType;
  }

  protected _createInputValueTypeReference(
    field: InputValueNode,
    fieldType: TypeNode,
    level = 0
  ): ts.TypeNode {
    if (fieldType instanceof NonNullTypeNode) {
      return this._createInputValueTypeReference(field, fieldType.type, level);
    }

    if (fieldType instanceof ListTypeNode) {
      const elementType = this._createInputValueTypeReference(field, fieldType.type, level + 1);
      const arrayType = ts.factory.createArrayTypeNode(elementType);

      return isNullableTypeNode(field.type, level)
        ? ts.factory.createTypeReferenceNode("Maybe", [arrayType])
        : arrayType;
    }

    const baseType = ts.factory.createTypeReferenceNode(
      this._createTypeNameIdentifier(fieldType.name)
    );

    return isNullableTypeNode(field.type, level)
      ? ts.factory.createTypeReferenceNode("Maybe", [baseType])
      : baseType;
  }

  protected _createFieldMembers(definition: ObjectNode | InterfaceNode) {
    const members: ts.TypeElement[] = [];

    for (const field of definition.fields ?? []) {
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

    return members;
  }

  protected _createInputValueMembers(definition: InputObjectNode) {
    const members: ts.TypeElement[] = [];

    for (const field of definition.fields ?? []) {
      const questionToken = isNullableTypeNode(field.type)
        ? ts.factory.createToken(ts.SyntaxKind.QuestionToken)
        : undefined;

      const typeNode = this._createInputValueTypeReference(field, field.type);

      const propertySignature = ts.factory.createPropertySignature(
        undefined,
        ts.factory.createIdentifier(field.name),
        questionToken,
        typeNode
      );

      members.push(propertySignature);
    }

    return members;
  }

  protected _createInputObjectType(definition: InputObjectNode) {
    const members = this._createInputValueMembers(definition);

    const inputObjectType = ts.factory.createTypeAliasDeclaration(
      /*modifiers*/ [ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)],
      ts.factory.createIdentifier(definition.name),
      /*typeParameters*/ undefined,
      ts.factory.createTypeLiteralNode(members)
    );

    return inputObjectType;
  }

  protected _createObjectType(definition: ObjectNode) {
    const members = this._createFieldMembers(definition);

    const objectType = ts.factory.createTypeAliasDeclaration(
      /*modifiers*/ [ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)],
      ts.factory.createIdentifier(definition.name),
      /*typeParameters*/ undefined,
      ts.factory.createTypeLiteralNode(members)
    );

    return objectType;
  }

  protected _createInterfaceType(definition: InterfaceNode) {
    const members = this._createFieldMembers(definition);

    const interfaceType = ts.factory.createInterfaceDeclaration(
      /*modifiers*/ [ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)],
      ts.factory.createIdentifier(definition.name),
      /*typeParameters*/ undefined,
      /*heritageClauses*/ undefined,
      members
    );

    return interfaceType;
  }

  protected _createUnionType(definition: UnionNode) {
    if (!definition.types?.length) {
      throw new TransformerPluginExecutionError(
        this.name,
        `Union type ${definition.name} must have at least one member type.`
      );
    }

    const refs = definition.types.map((type) =>
      ts.factory.createTypeReferenceNode(ts.factory.createIdentifier("RequiredTypename"), [
        ts.factory.createTypeReferenceNode(ts.factory.createIdentifier(type.name), undefined),
      ])
    );

    const unionType = ts.factory.createTypeAliasDeclaration(
      /*modifiers*/ [ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)],
      ts.factory.createIdentifier(definition.name),
      /*typeParameters*/ undefined,
      ts.factory.createUnionTypeNode(refs)
    );

    return unionType;
  }

  protected _createEnumType(definition: EnumNode) {
    if (!definition.values?.length) {
      throw new TransformerPluginExecutionError(
        this.name,
        `Enum type ${definition.name} must have at least one value.`
      );
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

    return enumType;
  }
}
