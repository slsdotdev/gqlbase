import {
  Kind,
  UnionTypeDefinitionNode,
  UnionTypeExtensionNode,
  NamedTypeNode as INamedTypeNode,
} from "graphql";
import { DirectiveNode } from "./DirectiveNode";
import { NamedTypeNode } from "./TypeNode";
import { WithDirectivesNode } from "./WithDirectivesNode";

export class UnionNode extends WithDirectivesNode {
  kind: Kind.UNION_TYPE_DEFINITION = Kind.UNION_TYPE_DEFINITION;
  name: string;
  types?: NamedTypeNode[] | undefined;

  constructor(name: string, types?: NamedTypeNode[], directives?: DirectiveNode[] | undefined) {
    super(name, directives);

    this.name = name;
    this.types = types ?? undefined;
  }

  public hasType(type: string) {
    return this.types?.some((node) => node.name === type) ?? false;
  }

  public addType(type: string | NamedTypeNode | INamedTypeNode) {
    const typeNode =
      type instanceof NamedTypeNode
        ? type
        : typeof type === "string"
          ? NamedTypeNode.create(type)
          : NamedTypeNode.fromDefinition(type);

    if (this.hasType(typeNode.name)) {
      throw new Error(`Type ${typeNode.name} already exists on union ${this.name}`);
    }

    this.types = this.types ?? [];
    this.types.push(typeNode);

    return this;
  }

  public removeType(type: string) {
    this.types = this.types?.filter((node) => node.name !== type);
    return this;
  }

  public extend(definition: UnionTypeExtensionNode) {
    const { types, directives } = definition;

    if (types) {
      for (const type of types) {
        this.addType(type);
      }
    }

    if (directives) {
      for (const directive of directives) {
        this.addDirective(directive);
      }
    }

    return this;
  }

  public serialize(): UnionTypeDefinitionNode {
    return {
      kind: Kind.UNION_TYPE_DEFINITION,
      name: {
        kind: Kind.NAME,
        value: this.name,
      },
      types: this.types?.map((type) => type.serialize()),
      directives: this.directives?.map((node) => node.serialize()),
    };
  }

  static create(
    name: string,
    types?: (NamedTypeNode | string)[],
    directives?: DirectiveNode[]
  ): UnionNode {
    return new UnionNode(
      name,
      types?.map((type) => (type instanceof NamedTypeNode ? type : NamedTypeNode.create(type))),
      directives
    );
  }

  static fromDefinition(definition: UnionTypeDefinitionNode) {
    return new UnionNode(
      definition.name.value,
      definition.types?.map((node) => NamedTypeNode.create(node.name.value)),
      definition.directives?.map((node) => DirectiveNode.fromDefinition(node))
    );
  }
}
