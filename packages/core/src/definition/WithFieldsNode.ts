import { FieldDefinitionNode, StringValueNode } from "graphql";
import { FieldNode } from "./FieldNode.js";
import { WithDirectivesNode } from "./WithDirectivesNode.js";
import { DirectiveNode } from "./DirectiveNode.js";

export abstract class WithFieldsNode extends WithDirectivesNode {
  fields?: FieldNode[] | undefined;

  constructor(
    name: string,
    description?: StringValueNode,
    directives?: DirectiveNode[],
    fields?: FieldNode[]
  ) {
    super(name, description, directives);

    this.fields = fields;
  }

  public hasField(name: string): boolean {
    return this.fields?.some((field) => field.name === name) ?? false;
  }

  public getField(name: string) {
    return this.fields?.find((field) => field.name === name);
  }

  public getFields(): FieldNode[] {
    return this.fields ?? [];
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
