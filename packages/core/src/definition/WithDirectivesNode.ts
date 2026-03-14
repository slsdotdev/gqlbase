import { ConstDirectiveNode } from "graphql";
import { DirectiveNode } from "./DirectiveNode";

export class WithDirectivesNode {
  name: string;
  directives?: DirectiveNode[] | undefined;

  constructor(name: string, directives?: DirectiveNode[]) {
    this.name = name;
    this.directives = directives;
  }

  public hasDirective(name: string) {
    return this.directives?.some((directive) => directive.name === name) ?? false;
  }

  public getDirective(name: string) {
    return this.directives?.find((directive) => directive.name === name);
  }

  public addDirective(directive: string | DirectiveNode | ConstDirectiveNode) {
    const node =
      directive instanceof DirectiveNode
        ? directive
        : typeof directive === "string"
          ? DirectiveNode.create(directive)
          : DirectiveNode.fromDefinition(directive);

    if (this.hasDirective(node.name)) {
      throw new Error(`Directive ${node.name} already exists on node ${this.name}`);
    }

    this.directives = this.directives ?? [];
    this.directives.push(node);
    return this;
  }

  public removeDirective(name: string) {
    this.directives = this.directives?.filter((directive) => directive.name !== name);
    return this;
  }
}
