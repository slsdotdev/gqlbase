import {
  EnumTypeDefinitionNode,
  EnumTypeExtensionNode,
  EnumValueDefinitionNode,
  Kind,
} from "graphql";
import { WithDirectivesNode } from "./WithDirectivesNode";
import { DirectiveNode } from "./DirectiveNode";
import { EnumValueNode } from "./EnumValueNode";

export class EnumNode extends WithDirectivesNode {
  kind: Kind.ENUM_TYPE_DEFINITION = Kind.ENUM_TYPE_DEFINITION;
  name: string;
  values?: EnumValueNode[] | undefined;

  constructor(name: string, values?: EnumValueNode[], directives?: DirectiveNode[]) {
    super(name, directives);

    this.name = name;
    this.values = values;
  }

  public hasValue(name: string) {
    return this.values?.some((value) => value.name === name) ?? false;
  }

  public addValue(value: string | EnumValueNode | EnumValueDefinitionNode) {
    const valueNode =
      value instanceof EnumValueNode
        ? value
        : typeof value === "string"
          ? EnumValueNode.create(value)
          : EnumValueNode.fromDefinition(value);

    if (this.hasValue(valueNode.name)) {
      throw new Error(`Value ${valueNode.name} already exists on enum ${this.name}`);
    }

    this.values = this.values ?? [];
    this.values.push(valueNode);
    return this;
  }

  public removeValue(name: string) {
    this.values = this.values?.filter((value) => value.name !== name);
    return this;
  }

  public extend(definition: EnumTypeExtensionNode) {
    const { values, directives } = definition;

    if (values) {
      for (const value of values) {
        this.addValue(value);
      }
    }

    if (directives) {
      for (const directive of directives) {
        this.addDirective(directive);
      }
    }

    return this;
  }

  public serialize(): EnumTypeDefinitionNode {
    return {
      kind: Kind.ENUM_TYPE_DEFINITION,
      name: {
        kind: Kind.NAME,
        value: this.name,
      },
      values: this.values?.map((value) => value.serialize()),
      directives: this.directives?.map((directive) => directive.serialize()),
    };
  }

  static create(name: string, values?: string[], directives?: DirectiveNode[]) {
    return new EnumNode(
      name,
      values?.map((value) => EnumValueNode.create(value)),
      directives
    );
  }

  static fromDefinition(definition: EnumTypeDefinitionNode) {
    return new EnumNode(
      definition.name.value,
      definition.values?.map((value) => EnumValueNode.fromDefinition(value)) ?? undefined,
      definition.directives?.map((directive) => DirectiveNode.fromDefinition(directive))
    );
  }
}
