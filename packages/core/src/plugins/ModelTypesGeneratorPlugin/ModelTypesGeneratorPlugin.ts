import ts from "typescript";
import { createPluginFactory } from "../createPluginFactory.js";
import { type ITransformerContext } from "../../context/index.js";
import { createFileHeaders } from "@gqlbase/shared/codegen";
import { TransformerPluginExecutionError } from "@gqlbase/shared/errors";
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
import { SCHEMA_TYPES_FILE } from "./ModelTypesGeneratorPlugin.utils.js";
import { isRelationField } from "../RelationsPlugin/RelationsPlugin.utils.js";
import { isInternal } from "../InternalUtilsPlugin/index.js";
import { isSemanticNullable } from "../RfcFeaturesPlugin/RfcFeaturesPlugin.utils.js";
import { TypesGeneratorBase } from "../TypesGeneratorBase/TypesGeneratorBase.js";
import { collectPublicDefinitions, isPublicSchemaField } from "../SchemaGeneratorPlugin/index.js";

/**
 * Writes `schema.types.ts`: support types that match the output schema, for every generator and application to build on: the definitions
 * and fields that reach the client schema (see `isPublicSchemaField` and `collectPublicDefinitions`). It runs in `generate`, before
 * `cleanup`, so it leaves out what cleanup will remove itself.
 *
 * - Each object and interface has three parts: `<Type>OwnFields` (its fields, without relations), `<Type>Relations` (its relations, all
 *   optional, since each has its own resolver) and `<Type>Full` (both). Fields reference the `Full` part of other types.
 * - `Scalars` maps each scalar to its `input` and `output` type, and fields reference it: `Scalars["UUID"]["output"]`.
 * - Unions, inputs and enums keep their name.
 */
export class ModelTypesGeneratorPlugin extends TypesGeneratorBase {
  private nodes: ts.Node[] = [];
  private publicDefinitions: Set<string> | null = null;
  protected useScalarsMap = true;

  constructor(context: ITransformerContext) {
    super("ModelTypesGeneratorPlugin", context);
  }

  private _getContent() {
    const file = ts.createSourceFile(
      SCHEMA_TYPES_FILE,
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

  protected _getObjectTypeName(name: string) {
    return `${name}Full`;
  }

  private _createTypeAlias(name: string, type: ts.TypeNode) {
    return ts.factory.createTypeAliasDeclaration(
      [ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)],
      ts.factory.createIdentifier(name),
      undefined,
      type
    );
  }

  private _createMembers(definition: ObjectNode | InterfaceNode, relations: boolean) {
    const members: ts.TypeElement[] = [];

    for (const field of definition.fields ?? []) {
      if (!isPublicSchemaField(field, definition) || isRelationField(field) !== relations) {
        continue;
      }

      members.push(
        ts.factory.createPropertySignature(
          undefined,
          ts.factory.createIdentifier(field.name),
          relations || isSemanticNullable(field)
            ? ts.factory.createToken(ts.SyntaxKind.QuestionToken)
            : undefined,
          this._createValueTypeReference(field, field.type)
        )
      );
    }

    return members;
  }

  private _createObjectParts(definition: ObjectNode | InterfaceNode) {
    const own = this._getOwnFieldsTypeName(definition.name);
    const relations = `${definition.name}Relations`;

    return [
      this._createTypeAlias(
        own,
        ts.factory.createTypeLiteralNode(this._createMembers(definition, false))
      ),
      this._createTypeAlias(
        relations,
        ts.factory.createTypeLiteralNode(this._createMembers(definition, true))
      ),
      this._createTypeAlias(
        this._getObjectTypeName(definition.name),
        ts.factory.createIntersectionTypeNode([
          ts.factory.createTypeReferenceNode(own),
          ts.factory.createTypeReferenceNode(relations),
        ])
      ),
    ];
  }

  /**
   * `{ UUID: { input: string; output: string } }`, for the built-ins and every public scalar.
   */
  private _createScalars(publicDefinitions: Set<string>) {
    const names = ["ID", "String", "Int", "Float", "Boolean"];

    for (const name of publicDefinitions) {
      const node = this.context.document.getNode(name);

      if (node && isScalarNode(node) && !names.includes(name)) {
        names.push(name);
      }
    }

    return this._createTypeAlias(
      "Scalars",
      ts.factory.createTypeLiteralNode(
        names.map((name) =>
          ts.factory.createPropertySignature(
            undefined,
            ts.factory.createIdentifier(name),
            undefined,
            ts.factory.createTypeLiteralNode(
              (["input", "output"] as const).map((mode) =>
                ts.factory.createPropertySignature(
                  undefined,
                  ts.factory.createIdentifier(mode),
                  undefined,
                  this._createScalarTypeNode(name, mode)
                )
              )
            )
          )
        )
      )
    );
  }

  /**
   * The generated names live next to the schema's own: a schema type with one of them would declare it twice.
   */
  private _checkNames(publicDefinitions: Set<string>) {
    const generated = new Map<string, string>([
      ["Maybe", "the nullable helper"],
      ["Scalars", "the scalar map"],
    ]);

    for (const name of publicDefinitions) {
      const node = this.context.document.getNode(name);

      if (node && (isObjectNode(node) || isInterfaceNode(node)) && !isOperationNode(node)) {
        for (const part of ["OwnFields", "Relations", "Full"]) {
          generated.set(`${name}${part}`, `a part of ${name}`);
        }
      }
    }

    for (const [name, purpose] of generated) {
      if (this.context.document.getNode(name)) {
        throw new TransformerPluginExecutionError(
          this.name,
          `The schema declares ${name}, but the schema types generate ${name} as ${purpose}. Rename the type.`
        );
      }
    }
  }

  public before() {
    this.publicDefinitions = null;

    this.nodes = [...createFileHeaders()];

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
      !isOperationNode(definition) &&
      !isInternal(definition) &&
      !isScalarNode(definition) &&
      !isDirectiveDefinitionNode(definition)
    );
  }

  public generate(definition: DefinitionNode) {
    // Collected on the first call: execute has finished, and nothing changes the document during generate.
    if (!this.publicDefinitions) {
      this.publicDefinitions = collectPublicDefinitions(this.context);
      this._checkNames(this.publicDefinitions);
      this.nodes.push(this._createScalars(this.publicDefinitions));
    }

    if (!this.publicDefinitions.has(definition.name)) {
      return;
    }

    if (isInterfaceNode(definition) || isObjectNode(definition)) {
      return this.nodes.push(...this._createObjectParts(definition));
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
      path: SCHEMA_TYPES_FILE,
      filename: SCHEMA_TYPES_FILE,
      content,
    });

    return { schemaTypes: content };
  }
}

export const modelTypesGeneratorPlugin = createPluginFactory(ModelTypesGeneratorPlugin);
