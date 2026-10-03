import ts from "typescript";
import { TransformerPluginBase } from "../TransformerPluginBase.js";
import { isBuildInScalar } from "@gqlbase/shared/definition";
import { getInputTypeHint, getTupleSize, getTypeHint } from "../InternalUtilsPlugin/index.js";
import {
  EnumNode,
  FieldNode,
  isEnumNode,
  isInputObjectNode,
  isInterfaceNode,
  isObjectNode,
  isUnionNode,
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
import { collectPublicDefinitions } from "../SchemaGeneratorPlugin/SchemaGeneratorPlugin.utils.js";

/**
 * Which side of the API a scalar is read on: arguments and input fields are `input`, fields are `output`. They differ for a scalar whose
 * type hint has an `input` (AWSJSON is a string on input and an object on output).
 */
export type ScalarMode = "input" | "output";

/**
 * The named types a generated file references: those it imports from `schema.types.ts`, and local declarations for those the schema types do not export.
 */
export interface TypeReferences {
  imports: Set<string>;
  declarations: Map<string, ts.Node>;
}

export const createTypeReferences = (): TypeReferences => ({
  imports: new Set(),
  declarations: new Map(),
});

export abstract class TypesGeneratorBase extends TransformerPluginBase {
  /**
   * When true, scalars are referenced through the `Scalars` map of the schema types (`Scalars["UUID"]["output"]`) instead of their
   * TypeScript type.
   */
  protected useScalarsMap = false;
  private _publicCache: { document: unknown; names: Set<string> } | null = null;

  /**
   * The definitions in the client schema, collected once per document.
   */
  protected _getPublicDefinitions(): Set<string> {
    if (this._publicCache?.document !== this.context.document) {
      this._publicCache = {
        document: this.context.document,
        names: collectPublicDefinitions(this.context),
      };
    }

    return this._publicCache.names;
  }

  /**
   * The name of the schema types' part of an object or interface that holds its fields, without relations: `<Type>OwnFields`.
   */
  protected _getOwnFieldsTypeName(name: string) {
    return `${name}OwnFields`;
  }

  /**
   * The TypeScript name an object or interface is referenced by. A public one is the schema types' `<Type>OwnFields`, a stored shape;
   * any other is declared locally under its own name (see `_referenceType`). Generators override it to reference another part.
   */
  protected _getObjectTypeName(name: string): string {
    return this._getPublicDefinitions().has(name) ? this._getOwnFieldsTypeName(name) : name;
  }
  /**
   * Records a named type that generated code references. Scalars need nothing. A public definition is imported from the schema types. Any other definition is declared locally, with the stored shape (every non-internal field), and the types it references are recorded the same way.
   *
   * Call it during `generate`: definitions that are not public are removed from the document before `output`.
   *
   * @param name The referenced type name.
   * @param refs Where imports and local declarations are collected.
   * @param publicDefinitions The definitions the schema types export (see `collectPublicDefinitions`).
   */
  protected _referenceType(name: string, refs: TypeReferences, publicDefinitions: Set<string>) {
    if (isBuildInScalar(name) || refs.imports.has(name) || refs.declarations.has(name)) {
      return;
    }

    const node = this.context.document.getNode(name);

    if (!node || isScalarNode(node) || isInternal(node)) {
      return;
    }

    if (publicDefinitions.has(name)) {
      refs.imports.add(
        isObjectNode(node) || isInterfaceNode(node) ? this._getOwnFieldsTypeName(name) : name
      );
      return;
    }

    if (isEnumNode(node)) {
      refs.declarations.set(name, this._createEnumType(node));
      return;
    }

    if (isUnionNode(node)) {
      const members = (node.types ?? []).map((member) => member.getTypeName());

      refs.declarations.set(
        name,
        ts.factory.createTypeAliasDeclaration(
          [ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)],
          ts.factory.createIdentifier(name),
          undefined,
          ts.factory.createUnionTypeNode(
            members.map((member) =>
              ts.factory.createTypeReferenceNode(this._getObjectTypeName(member))
            )
          )
        )
      );

      members.forEach((member) => this._referenceType(member, refs, publicDefinitions));
      return;
    }

    if (isInputObjectNode(node)) {
      refs.declarations.set(name, this._createInputObjectType(node));

      for (const field of node.fields ?? []) {
        this._referenceType(field.type.getTypeName(), refs, publicDefinitions);
      }

      return;
    }

    if (isObjectNode(node) || isInterfaceNode(node)) {
      const fields = (node.fields ?? []).filter((field) => !isInternal(field));

      // Declared before its fields are followed, so a type that references itself stops the walk.
      refs.declarations.set(
        name,
        ts.factory.createTypeAliasDeclaration(
          [ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)],
          ts.factory.createIdentifier(name),
          undefined,
          ts.factory.createTypeLiteralNode(
            fields.map((field) =>
              ts.factory.createPropertySignature(
                undefined,
                ts.factory.createIdentifier(field.name),
                isSemanticNullable(field)
                  ? ts.factory.createToken(ts.SyntaxKind.QuestionToken)
                  : undefined,
                this._createValueTypeReference(field, field.type)
              )
            )
          )
        )
      );

      for (const field of fields) {
        this._referenceType(field.type.getTypeName(), refs, publicDefinitions);
      }
    }
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
