import {
  FieldDefinitionNode,
  InputObjectTypeDefinitionNode,
  InputObjectTypeExtensionNode,
  InputValueDefinitionNode,
  Kind,
  ObjectTypeDefinitionNode,
} from "graphql/language";
import { WithDirectivesNode } from "./WithDirectivesNode";
import { InputValueNode } from "./InputValueNode";
import { DirectiveNode } from "./DirectiveNode";

export class InputObjectNode extends WithDirectivesNode {
  kind: Kind.INPUT_OBJECT_TYPE_DEFINITION = Kind.INPUT_OBJECT_TYPE_DEFINITION;
  name: string;
  fields?: InputValueNode[] | undefined;

  constructor(name: string, fields?: InputValueNode[], directives?: DirectiveNode[] | undefined) {
    super(name, directives);

    this.name = name;
    this.fields = fields;
  }

  public hasField(name: string): boolean {
    return this.fields?.some((field) => field.name === name) ?? false;
  }

  public addField(field: InputValueNode | InputValueDefinitionNode | FieldDefinitionNode) {
    const fieldNode =
      field instanceof InputValueNode ? field : InputValueNode.fromDefinition(field);

    if (this.hasField(fieldNode.name)) {
      throw new Error(`Field ${field.name} already exists on type ${this.name}`);
    }

    this.fields = this.fields ?? [];
    this.fields.push(fieldNode);

    return this;
  }

  public removeField(name: string) {
    this.fields = this.fields?.filter((field) => field.name !== name);
    return this;
  }

  public extend(definition: InputObjectTypeExtensionNode) {
    const { fields, directives } = definition;

    if (fields) {
      for (const field of fields) {
        this.addField(field);
      }
    }

    if (directives) {
      for (const directive of directives) {
        this.addDirective(directive);
      }
    }

    return this;
  }

  public serialize(): InputObjectTypeDefinitionNode {
    return {
      kind: Kind.INPUT_OBJECT_TYPE_DEFINITION,
      name: {
        kind: Kind.NAME,
        value: this.name,
      },
      fields: this.fields?.map((field) => field.serialize()),
      directives: this.directives?.map((directive) => directive.serialize()),
    };
  }

  static fromDefinition(
    definition: ObjectTypeDefinitionNode | InputObjectTypeDefinitionNode
  ): InputObjectNode {
    return new InputObjectNode(
      definition.name.value,
      definition.fields?.map((node) => InputValueNode.fromDefinition(node)),
      definition.directives?.map((node) => DirectiveNode.fromDefinition(node))
    );
  }

  static create(
    name: string,
    fields?: InputValueNode[],
    directives?: DirectiveNode[]
  ): InputObjectNode {
    return new InputObjectNode(name, fields, directives);
  }
}
