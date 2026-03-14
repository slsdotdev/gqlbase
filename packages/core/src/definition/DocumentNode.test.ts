import { describe, it, expect } from "vitest";
import { parse } from "graphql";
import { DocumentNode } from "./DocumentNode";
import { ObjectNode } from "./ObjectNode";

const definition = /* GraphQL */ `
  type Query {
    getUser(id: ID!): User
  }

  type Mutation {
    createUser(name: String!): User
  }

  type User {
    id: ID!
    name: String!
  }
`;

describe("DocumentNode", () => {
  it("creates document from string", () => {
    const document = DocumentNode.fromSource(definition);
    expect(document.definitions).toBeInstanceOf(Map);
    expect(document.definitions.size).toEqual(3);
  });

  it("creates document from definition", () => {
    const document = DocumentNode.fromDefinition(parse(definition));
    expect(document.definitions).toBeInstanceOf(Map);
    expect(document.definitions.size).toEqual(3);
  });

  it("parses document definition types", () => {
    const document = DocumentNode.fromSource(/* GraphQL */ `
      scalar DateTime
      directive @auth on FIELD_DEFINITION

      interface Node {
        id: ID!
      }

      type User implements Node {
        id: ID!
        name: String!
      }
      type Query {
        getUser(id: ID!): User
      }
      type Mutation {
        createUser(input: CreateUserInput!): User
      }

      input CreateUserInput {
        name: String!
      }
    `);

    expect(document.definitions.size).toEqual(7);
  });

  it("ignores non-document definitions", () => {
    const document = DocumentNode.fromSource(/* GraphQL */ `
      query GetUser($id: ID!) {
        getUser(id: $id)
      }
    `);

    expect(document.definitions.size).toEqual(0);
  });

  it("merges extensions", () => {
    const document = DocumentNode.fromSource(/* GraphQL */ `
      scalar DateTime
      directive @auth on FIELD_DEFINITION

      extend scalar DateTime @auth

      interface Node {
        id: ID!
      }

      extend interface Node {
        createdAt: DateTime!
      }

      type User implements Node {
        id: ID!
        name: String!
        status: UserStatus
      }

      enum UserStatus {
        ACTIVE
        INACTIVE
      }

      extend enum UserStatus {
        PENDING
        SUSPENDED
      }

      type Post implements Node {
        id: ID!
        title: String!
        content: String
      }

      union SearchResult = User

      extend union SearchResult = Post

      type Query {
        getUser(id: ID!): User
      }

      extend type Query {
        getUsers: [User]
      }

      type Mutation {
        createUser(input: CreateUserInput!): User
      }

      input CreateUserInput {
        name: String!
      }

      extend input CreateUserInput {
        status: UserStatus
      }
    `);

    expect(document.definitions.size).toEqual(10);
  });

  it("ignores extension if node does not exist", () => {
    const document = DocumentNode.fromSource(/* GraphQL */ `
      extend type Query {
        getUser(id: ID!): User
      }
    `);
    expect(document.definitions.size).toEqual(0);
  });

  it("gets query node", () => {
    const document = DocumentNode.fromSource(definition);
    const queryNode = document.getQueryNode();
    expect(queryNode).toBeInstanceOf(ObjectNode);
  });

  it("auto creates Query node if missing", () => {
    const document = DocumentNode.fromSource(/* GraphQL */ `
      type User {
        id: ID
        name: String
      }
    `);
    const queryNode = document.getQueryNode();
    expect(queryNode).toBeInstanceOf(ObjectNode);
  });

  it("throws error if Query node is not an object type", () => {
    const document = DocumentNode.fromSource(/* GraphQL */ `
      interface Query {
        id: ID
      }
    `);

    expect(() => document.getQueryNode()).toThrow("Query node must be an object type");
  });

  it("gets mutation node", () => {
    const document = DocumentNode.fromSource(definition);
    const mutationNode = document.getMutationNode();
    expect(mutationNode).toBeInstanceOf(ObjectNode);
  });

  it("auto creates Mutation node if missing", () => {
    const document = DocumentNode.fromSource(/* GraphQL */ `
      type User {
        id: ID
        name: String
      }
    `);
    const mutationNode = document.getMutationNode();
    expect(mutationNode).toBeInstanceOf(ObjectNode);
  });

  it("throws error if Mutation node is not an object type", () => {
    const document = DocumentNode.fromSource(/* GraphQL */ `
      interface Mutation {
        id: ID
      }
    `);
    expect(() => document.getMutationNode()).toThrow("Mutation node must be an object type");
  });

  it("checks if node exists", () => {
    const document = DocumentNode.fromSource(definition);
    expect(document.hasNode("User")).toBe(true);
    expect(document.hasNode("Unknown")).toBe(false);
  });

  it("adds node to document", () => {
    const document = DocumentNode.fromSource(definition);
    document.addNode(ObjectNode.create("Viewer"));
    expect(document.hasNode("Viewer")).toBe(true);
  });

  it("throws error when adding duplicate node", () => {
    const document = DocumentNode.fromSource(definition);
    expect(() => document.addNode(ObjectNode.create("User"))).toThrow();
  });

  it("removes node from document", () => {
    const document = DocumentNode.fromSource(definition);
    document.removeNode("User");
    expect(document.hasNode("User")).toBe(false);
  });

  it("validates document", () => {
    const document = DocumentNode.fromSource(definition);
    const errors = document.validate();
    expect(errors).toHaveLength(0);
  });

  it("returns error if document is invalid", () => {
    const document = DocumentNode.fromSource(/* GraphQL */ `
      type Query {
        user(id: ID!): User
      }
    `);
    const errors = document.validate();
    expect(errors).toHaveLength(1);
  });

  it("serializes document to string", () => {
    const document = DocumentNode.fromSource(definition);
    const serialized = document.serialize();
    expect(serialized).toEqual(
      expect.objectContaining({ kind: "Document", definitions: expect.any(Array) })
    );
  });

  it("prints document to string", () => {
    const document = DocumentNode.fromSource(definition);
    const printed = document.print();
    expect(printed).toEqual(expect.stringContaining("type Query"));
  });
});
