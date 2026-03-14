import { FieldDefinitionNode } from "graphql";
import { FieldNode } from "./FieldNode";
import { WithDirectivesNode } from "./WithDirectivesNode";
import { DirectiveNode } from "./DirectiveNode";

export class WithFieldsNode extends WithDirectivesNode {
  name: string;
  fields?: FieldNode[] | undefined;

  constructor(name: string, fields?: FieldNode[], directives?: DirectiveNode[]) {
    super(name, directives);

    this.name = name;
    this.fields = fields;
  }

  public hasField(name: string): boolean {
    return this.fields?.some((field) => field.name === name) ?? false;
  }

  public getField(name: string) {
    return this.fields?.find((field) => field.name === name);
  }

  public addField(field: FieldNode | FieldDefinitionNode) {
    const node = field instanceof FieldNode ? field : FieldNode.fromDefinition(field);

    if (this.hasField(node.name)) {
      throw new Error(`Field ${node.name} already exists on node ${this.name}`);
    }

    this.fields = this.fields ?? [];
    this.fields.push(node);

    return this;
  }

  public removeField(name: string) {
    this.fields = this.fields?.filter((field) => field.name !== name);
    return this;
  }
}
