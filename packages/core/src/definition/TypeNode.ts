import {
  NamedTypeNode as INamedTypeNode,
  ListTypeNode as IListTypeNode,
  NonNullTypeNode as INonNullTypeNode,
  Kind,
  Location,
} from "graphql";

export class NamedTypeNode {
  kind: Kind.NAMED_TYPE = Kind.NAMED_TYPE;
  name: string;
  loc?: Location;
  constructor(name: string, loc?: Location) {
    this.name = name;
    this.loc = loc;
  }

  public getTypeName() {
    return this.name;
  }

  public serialize(): INamedTypeNode {
    return {
      kind: Kind.NAMED_TYPE,
      name: {
        kind: Kind.NAME,
        value: this.name,
      },
      loc: this.loc,
    };
  }

  static create(name: string) {
    return new NamedTypeNode(name);
  }

  static fromDefinition(definition: INamedTypeNode): NamedTypeNode {
    return new NamedTypeNode(definition.name.value, definition.loc);
  }
}

export class ListTypeNode {
  kind: Kind.LIST_TYPE = Kind.LIST_TYPE;
  type: TypeNode;
  loc?: Location;

  constructor(type: TypeNode, loc?: Location) {
    this.type = type;
    this.loc = loc;
  }

  getTypeName(): string {
    return this.type.getTypeName();
  }

  public serialize(): IListTypeNode {
    return {
      kind: Kind.LIST_TYPE,
      type: this.type.serialize(),
      loc: this.loc,
    };
  }

  static create(type: TypeNode | string): ListTypeNode {
    const node = typeof type === "string" ? NamedTypeNode.create(type) : type;
    return new ListTypeNode(node);
  }

  static fromDefinition(definition: IListTypeNode): ListTypeNode {
    return new ListTypeNode(
      definition.type.kind === Kind.NON_NULL_TYPE
        ? NonNullTypeNode.fromDefinition(definition.type)
        : definition.type.kind === Kind.LIST_TYPE
          ? ListTypeNode.fromDefinition(definition.type)
          : NamedTypeNode.fromDefinition(definition.type)
    );
  }
}

export class NonNullTypeNode {
  kind: Kind.NON_NULL_TYPE = Kind.NON_NULL_TYPE;
  type: NamedTypeNode | ListTypeNode;
  loc?: Location;

  constructor(type: NamedTypeNode | ListTypeNode, loc?: Location) {
    this.type = type;
    this.loc = loc;
  }

  public getTypeName(): string {
    return this.type.getTypeName();
  }

  public serialize(): INonNullTypeNode {
    return {
      kind: Kind.NON_NULL_TYPE,
      type: this.type.serialize(),
      loc: this.loc,
    };
  }

  static create(type: NamedTypeNode | ListTypeNode | string | string[]): NonNullTypeNode {
    if (Array.isArray(type)) {
      return new NonNullTypeNode(ListTypeNode.create(type[0]));
    }

    if (typeof type === "string") {
      return new NonNullTypeNode(NamedTypeNode.create(type));
    }

    return new NonNullTypeNode(type);
  }

  static fromDefinition(definition: INonNullTypeNode): NonNullTypeNode {
    const node =
      definition.type.kind === Kind.NAMED_TYPE
        ? NamedTypeNode.fromDefinition(definition.type)
        : ListTypeNode.fromDefinition(definition.type);

    return new NonNullTypeNode(node, definition.loc);
  }
}

export type TypeNode = NamedTypeNode | ListTypeNode | NonNullTypeNode;
