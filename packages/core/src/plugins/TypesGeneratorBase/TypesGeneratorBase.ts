import ts from "typescript";
import { TransformerPluginBase } from "../TransformerPluginBase.js";
import { isBuildInScalar } from "@gqlbase/shared/definition";
import { getInputTypeHint, getTupleSize, getTypeHint } from "../InternalUtilsPlugin/index.js";
import {
  EnumNode,
  FieldNode,
  isInterfaceNode,
  isObjectNode,
  InputObjectNode,
  InputValueNode,
  isNullableTypeNode,
  isScalarNode,
  ScalarNode,
  ListTypeNode,
  NonNullTypeNode,
  TypeNode,
  UnionNode,
} from "../../definition/index.js";
import { isSemanticNullable } from "../RfcFeaturesPlugin/index.js";
import { TransformerPluginExecutionError } from "@gqlbase/shared/errors";
import { isInternal } from "../InternalUtilsPlugin/index.js";
import { collectSchemaTypeDefinitions } from "../ModelTypesGeneratorPlugin/ModelTypesGeneratorPlugin.utils.js";

/**
 * Which side of the API a scalar is read on: arguments and input fields are `input`, fields are `output`. They differ for a scalar whose
 * type hint has an `input` (AWSJSON is a string on input and an object on output).
 */
export type ScalarMode = "input" | "output";

/**
 * The named types a generated file references, all imported from `schema.types.ts`.
 */
export interface TypeReferences {
  imports: Set<string>;
}

export const createTypeReferences = (): TypeReferences => ({
  imports: new Set(),
});

export abstract class TypesGeneratorBase extends TransformerPluginBase {
  /**
   * When true, scalars are referenced through the `Scalars` map of the schema types (`Scalars["UUID"]["output"]`) instead of their
   * TypeScript type.
   */
  protected useScalarsMap = false;
  private _schemaTypesCache: { document: unknown; names: Set<string> } | null = null;

  /**
   * The definitions the schema types declare (see `collectSchemaTypeDefinitions`), collected once per document.
   */
  protected _getSchemaTypeDefinitions(): Set<string> {
    if (this._schemaTypesCache?.document !== this.context.document) {
      this._schemaTypesCache = {
        document: this.context.document,
        names: collectSchemaTypeDefinitions(this.context),
      };
    }

    return this._schemaTypesCache.names;
  }

  /**
   * The name of the schema types' part of an object or interface that holds its fields, without relations: `<Type>OwnFields`.
   */
  protected _getOwnFieldsTypeName(name: string) {
    return `${name}OwnFields`;
  }

  /**
   * The TypeScript name an object or interface is referenced by: the schema types' `<Type>OwnFields`, its own fields. Generators override
   * it to reference another part.
   */
  protected _getObjectTypeName(name: string): string {
    return this._getSchemaTypeDefinitions().has(name) ? this._getOwnFieldsTypeName(name) : name;
  }

  /**
   * Records a named type that generated code references, to import from the schema types. Scalars and internal definitions need nothing.
   *
   * @param name The referenced type name.
   * @param refs Where the imports are collected.
   */
  protected _referenceType(name: string, refs: TypeReferences) {
    const node = this.context.document.getNode(name);

    if (isBuildInScalar(name) || !node || isScalarNode(node) || isInternal(node)) {
      return;
    }

    refs.imports.add(
      isObjectNode(node) || isInterfaceNode(node) ? this._getOwnFieldsTypeName(name) : name
    );
  }

  /**
   * The TypeScript type of a scalar from its type hint (the `input` hint on the input side), or of a built-in.
   */
  protected _createScalarTypeNode(typeName: string, mode: ScalarMode = "output"): ts.TypeNode {
    if (isBuildInScalar(typeName)) {
      switch (typeName) {
        case "Int":
        case "Float":
          return ts.factory.createKeywordTypeNode(ts.SyntaxKind.NumberKeyword);
        case "Boolean":
          return ts.factory.createKeywordTypeNode(ts.SyntaxKind.BooleanKeyword);
        default:
          return ts.factory.createKeywordTypeNode(ts.SyntaxKind.StringKeyword);
      }
    }

    const typeDef = this.context.document.getNodeOrThrow(typeName) as ScalarNode;
    const hint = mode === "input" ? getInputTypeHint(typeDef) : getTypeHint(typeDef);

    switch (hint) {
      case "id":
      case "string":
        return ts.factory.createKeywordTypeNode(ts.SyntaxKind.StringKeyword);
      case "number":
        return ts.factory.createKeywordTypeNode(ts.SyntaxKind.NumberKeyword);
      case "boolean":
        return ts.factory.createKeywordTypeNode(ts.SyntaxKind.BooleanKeyword);
      case "object":
        return ts.factory.createTypeReferenceNode("Record", [
          ts.factory.createKeywordTypeNode(ts.SyntaxKind.StringKeyword),
          ts.factory.createKeywordTypeNode(ts.SyntaxKind.UnknownKeyword),
        ]);
      case "unknown":
      default: {
        this.context.logger.warn(
          `Unknown type hint for scalar ${typeDef.name}. Defaulting to unknown.`
        );
        return ts.factory.createKeywordTypeNode(ts.SyntaxKind.UnknownKeyword);
      }
    }
  }

  /**
   * A reference to a named type: a scalar (through `Scalars` with `useScalarsMap`), an object or interface (`_getObjectTypeName`), or any
   * other definition by its name.
   */
  protected _createNamedTypeNode(typeName: string, mode: ScalarMode = "output"): ts.TypeNode {
    const typeDef = isBuildInScalar(typeName)
      ? null
      : this.context.document.getNodeOrThrow(typeName);

    if (!typeDef || isScalarNode(typeDef)) {
      if (!this.useScalarsMap) {
        return this._createScalarTypeNode(typeName, mode);
      }

      return ts.factory.createIndexedAccessTypeNode(
        ts.factory.createIndexedAccessTypeNode(
          ts.factory.createTypeReferenceNode("Scalars"),
          ts.factory.createLiteralTypeNode(ts.factory.createStringLiteral(typeName))
        ),
        ts.factory.createLiteralTypeNode(ts.factory.createStringLiteral(mode))
      );
    }

    if (isObjectNode(typeDef) || isInterfaceNode(typeDef)) {
      return ts.factory.createTypeReferenceNode(this._getObjectTypeName(typeName));
    }

    return ts.factory.createTypeReferenceNode(typeName);
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

    const baseType = this._createNamedTypeNode(fieldType.name, "output");

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
      const tupleSize = level === 0 ? getTupleSize(field) : null;
      const arrayType = tupleSize
        ? ts.setEmitFlags(
            ts.factory.createTupleTypeNode(Array.from({ length: tupleSize }, () => elementType)),
            ts.EmitFlags.SingleLine
          )
        : ts.factory.createArrayTypeNode(elementType);

      return isNullableTypeNode(field.type, level)
        ? ts.factory.createTypeReferenceNode("Maybe", [arrayType])
        : arrayType;
    }

    const baseType = this._createNamedTypeNode(fieldType.name, "input");

    return isNullableTypeNode(field.type, level)
      ? ts.factory.createTypeReferenceNode("Maybe", [baseType])
      : baseType;
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

  protected _createUnionType(definition: UnionNode) {
    if (!definition.types?.length) {
      throw new TransformerPluginExecutionError(
        this.name,
        `Union type ${definition.name} must have at least one member type.`
      );
    }

    const refs = definition.types.map((type) =>
      ts.factory.createTypeReferenceNode(this._getObjectTypeName(type.name))
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
