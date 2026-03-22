import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { TransformerContext } from "@gqlbase/core";
import {
  DirectiveDefinitionNode,
  DocumentNode,
  EnumNode,
  InputObjectNode,
  InterfaceNode,
  ObjectNode,
  ScalarNode,
  UnionNode,
} from "@gqlbase/core/definition";
import { AppSyncSchemaGeneratorPlugin } from "./AppSyncSchemaGeneratorPlugin.js";
import { ScalarsPlugin } from "../../base/index.js";
import { AppSyncUtilsPlugin } from "../AppSyncUtilsPlugin/AppSyncUtilsPlugin.js";

const generateSchema = (plugin: AppSyncSchemaGeneratorPlugin, context: TransformerContext) => {
  plugin.before();

  for (const definition of context.document.definitions.values()) {
    if (plugin.match(definition)) {
      plugin.generate(definition);
    }
  }

  return plugin.output();
};

describe("AppSyncSchemaGeneratorPlugin", () => {
  let plugin: AppSyncSchemaGeneratorPlugin;
  let context: TransformerContext;

  beforeAll(() => {
    context = new TransformerContext();
    plugin = new AppSyncSchemaGeneratorPlugin(context);
    context.registerPlugin(plugin);
  });

  afterEach(() => {
    context.finishWork();
  });

  describe("match", () => {
    it("excludes scalar definitions", () => {
      context.startWork(
        DocumentNode.fromSource(/* GraphQL */ `
          scalar Decimal

          type Query {
            amount: Decimal
          }
        `)
      );

      const scalar = context.document.getNode("Decimal") as ScalarNode;
      expect(scalar).toBeInstanceOf(ScalarNode);
      expect(plugin.match(scalar)).toBe(false);
    });

    it("excludes directive definitions", () => {
      context.startWork(
        DocumentNode.fromSource(/* GraphQL */ `
          directive @auth(requires: String!) on FIELD_DEFINITION

          type Query {
            me: String
          }
        `)
      );

      const directive = context.document.getNode("auth") as DirectiveDefinitionNode;
      expect(directive).toBeInstanceOf(DirectiveDefinitionNode);
      expect(plugin.match(directive)).toBe(false);
    });

    it("excludes internal definitions", () => {
      context.startWork(
        DocumentNode.fromSource(/* GraphQL */ `
          directive @gqlbase_internal on OBJECT

          type InternalType @gqlbase_internal {
            id: ID!
          }

          type Query {
            me: String
          }
        `)
      );

      const internal = context.document.getNode("InternalType") as ObjectNode;
      expect(plugin.match(internal)).toBe(false);
    });

    it("includes object types", () => {
      context.startWork(
        DocumentNode.fromSource(/* GraphQL */ `
          type User {
            id: ID!
            name: String!
          }
          type Query {
            me: User
          }
        `)
      );

      const user = context.document.getNode("User") as ObjectNode;

      expect(user).toBeInstanceOf(ObjectNode);
      expect(plugin.match(user)).toBe(true);
    });

    it("includes enum types", () => {
      context.startWork(
        DocumentNode.fromSource(/* GraphQL */ `
          enum Role {
            ADMIN
            USER
          }
          type Query {
            role: Role
          }
        `)
      );

      const role = context.document.getNode("Role") as EnumNode;

      expect(role).toBeInstanceOf(EnumNode);
      expect(plugin.match(role)).toBe(true);
    });

    it("includes input types", () => {
      context.startWork(
        DocumentNode.fromSource(/* GraphQL */ `
          input CreateUserInput {
            name: String!
          }
          type Query {
            me: String
          }
        `)
      );

      const input = context.document.getNode("CreateUserInput") as InputObjectNode;

      expect(input).toBeInstanceOf(InputObjectNode);
      expect(plugin.match(input)).toBe(true);
    });

    it("includes interface types", () => {
      context.startWork(
        DocumentNode.fromSource(/* GraphQL */ `
          interface Node {
            id: ID!
          }
          type Query {
            node: Node
          }
        `)
      );

      const node = context.document.getNode("Node") as InterfaceNode;

      expect(node).toBeInstanceOf(InterfaceNode);
      expect(plugin.match(node)).toBe(true);
    });

    it("includes union types", () => {
      context.startWork(
        DocumentNode.fromSource(/* GraphQL */ `
          type Cat {
            name: String!
          }

          type Dog {
            name: String!
          }

          union Pet = Cat | Dog

          type Query {
            pet: Pet
          }
        `)
      );

      const pet = context.document.getNode("Pet") as UnionNode;

      expect(pet).toBeInstanceOf(UnionNode);
      expect(plugin.match(pet)).toBe(true);
    });
  });

  describe("scalar replacement", () => {
    let plugin: AppSyncSchemaGeneratorPlugin;
    let context: TransformerContext;

    beforeAll(() => {
      context = new TransformerContext();
      plugin = new AppSyncSchemaGeneratorPlugin(context);
      context.registerPlugin(new ScalarsPlugin(context));
      context.registerPlugin(plugin);
    });

    afterEach(() => {
      context.finishWork();
    });

    it("preserves built-in scalars (String, Int, Float, Boolean, ID)", () => {
      context.startWork(
        DocumentNode.fromSource(/* GraphQL */ `
          type User {
            id: ID!
            name: String!
            age: Int
            score: Float
            active: Boolean!
          }

          type Query {
            me: User
          }
        `)
      );

      const {
        appsync: { schema },
      } = generateSchema(plugin, context);

      expect(schema).toContain("id: ID!");
      expect(schema).toContain("name: String!");
      expect(schema).toContain("age: Int");
      expect(schema).toContain("score: Float");
      expect(schema).toContain("active: Boolean!");
    });

    it("replaces base scalars in field types", () => {
      context.startWork(
        DocumentNode.fromSource(/* GraphQL */ `
          type User {
            id: UUID!
            email: EmailAddress!
            avatarUrl: URL
            phone: PhoneNumber
            ip: IPAddress
            date: Date!
            startTime: Time!
            timestamp: Timestamp!
            data: JSON
            createdAt: DateTime
          }

          type Query {
            me: User
          }
        `)
      );

      const { appsync } = generateSchema(plugin, context);

      expect(appsync.schema).toContain("AWSDateTime");
      expect(appsync.schema).not.toContain("createdAt: DateTime");
    });

    it("replaces scalars in non-null and list wrappers", () => {
      context.startWork(
        DocumentNode.fromSource(/* GraphQL */ `
          type Audit {
            timestamps: [DateTime!]!
            lastSeen: DateTime!
          }

          type Query {
            audit: Audit
          }
        `)
      );

      const {
        appsync: { schema },
      } = generateSchema(plugin, context);

      expect(schema).toContain("[AWSDateTime!]!");
      expect(schema).toContain("lastSeen: AWSDateTime!");
      expect(schema).not.toContain("lastSeen: DateTime!");
    });

    it("replaces scalars in input object fields", () => {
      context.startWork(
        DocumentNode.fromSource(/* GraphQL */ `
          input DateRangeInput {
            start: DateTime!
            end: DateTime!
          }

          type Query {
            events: String
          }
        `)
      );

      const {
        appsync: { schema },
      } = generateSchema(plugin, context);

      expect(schema).toContain("start: AWSDateTime!");
      expect(schema).toContain("end: AWSDateTime!");
    });

    it("supports custom scalar mappings via options", () => {
      const customContext = new TransformerContext();

      const customPlugin = new AppSyncSchemaGeneratorPlugin(customContext, {
        scalarMappings: { Decimal: "AWSTimestamp" },
      });

      customContext.registerPlugin(customPlugin);
      customContext.startWork(
        DocumentNode.fromSource(/* GraphQL */ `
          scalar Decimal
          type Money {
            amount: Decimal!
          }
          type Query {
            balance: Money
          }
        `)
      );

      const {
        appsync: { schema },
      } = generateSchema(customPlugin, customContext);

      expect(schema).toContain("AWSTimestamp");
      expect(schema).not.toContain("Decimal");
    });
  });

  describe("directive stripping", () => {
    it("removes custom directives from object types", () => {
      context.startWork(
        DocumentNode.fromSource(/* GraphQL */ `
          directive @model on OBJECT
          directive @scope(allow: [String!]!) on OBJECT | FIELD_DEFINITION

          type User @model @scope(allow: ["ADMIN"]) {
            id: ID!
            name: String!
          }

          type Query {
            me: User
          }
        `)
      );

      const {
        appsync: { schema },
      } = generateSchema(plugin, context);

      expect(schema).toContain("type User");
      expect(schema).not.toContain("@model");
      expect(schema).not.toContain("@scope");
    });

    it("removes custom directives from fields", () => {
      context.startWork(
        DocumentNode.fromSource(/* GraphQL */ `
          directive @readOnly on FIELD_DEFINITION
          directive @constraint(maxLength: Int) on FIELD_DEFINITION

          type User {
            id: ID!
            name: String! @constraint(maxLength: 100)
            createdAt: String! @readOnly
          }

          type Query {
            me: User
          }
        `)
      );

      const {
        appsync: { schema },
      } = generateSchema(plugin, context);

      expect(schema).toContain("name: String!");
      expect(schema).toContain("createdAt: String!");
      expect(schema).not.toContain("@readOnly");
      expect(schema).not.toContain("@constraint");
    });

    it("preserves AWS-specific directives", () => {
      context.startWork(
        DocumentNode.fromSource(/* GraphQL */ `
          directive @aws_api_key on FIELD_DEFINITION | OBJECT
          directive @aws_iam on FIELD_DEFINITION | OBJECT
          directive @aws_cognito_user_pools(cognito_groups: [String!]) on FIELD_DEFINITION | OBJECT

          type User @aws_api_key {
            id: ID!
            secretField: String! @aws_iam
            groupField: String @aws_cognito_user_pools(cognito_groups: ["admin"])
          }

          type Query {
            me: User
          }
        `)
      );

      const {
        appsync: { schema },
      } = generateSchema(plugin, context);

      expect(schema).toContain("@aws_api_key");
      expect(schema).toContain("@aws_iam");
      expect(schema).toContain("@aws_cognito_user_pools");
    });

    it("preserves @aws_subscribe directive on subscription fields", () => {
      context.startWork(
        DocumentNode.fromSource(/* GraphQL */ `
          directive @aws_subscribe(mutations: [String!]!) on FIELD_DEFINITION

          type Subscription {
            onCreateUser: User @aws_subscribe(mutations: ["createUser"])
          }

          type User {
            id: ID!
            name: String!
          }

          type Query {
            me: User
          }
        `)
      );

      const {
        appsync: { schema },
      } = generateSchema(plugin, context);

      expect(schema).not.toContain("directive @aws_subscribe");
      expect(schema).toContain("@aws_subscribe");
      expect(schema).toContain('mutations: ["createUser"]');
    });

    it("removes directives from interface types", () => {
      context.startWork(
        DocumentNode.fromSource(/* GraphQL */ `
          directive @cacheControl(maxAge: Int!) on FIELD_DEFINITION | OBJECT

          interface Timestamped @cacheControl(maxAge: 60) {
            createdAt: String
            updatedAt: String
          }

          type Query {
            now: String
          }
        `)
      );

      const {
        appsync: { schema },
      } = generateSchema(plugin, context);

      expect(schema).toContain("interface Timestamped");
      expect(schema).not.toContain("@cacheControl");
    });

    it("removes directives from input fields", () => {
      context.startWork(
        DocumentNode.fromSource(/* GraphQL */ `
          directive @constraint(minLength: Int, maxLength: Int) on FIELD_DEFINITION

          input CreateUserInput {
            name: String! @constraint(minLength: 1, maxLength: 100)
            email: String! @constraint(maxLength: 320)
          }

          type Mutation {
            createUser(input: CreateUserInput!): String
          }
        `)
      );

      const {
        appsync: { schema },
      } = generateSchema(plugin, context);

      expect(schema).toContain("name: String!");
      expect(schema).toContain("email: String!");
      expect(schema).not.toContain("@constraint");
    });
  });

  describe("type passthrough", () => {
    let plugin: AppSyncSchemaGeneratorPlugin;
    let context: TransformerContext;

    beforeAll(() => {
      context = new TransformerContext();
      plugin = new AppSyncSchemaGeneratorPlugin(context);
      context.registerPlugin(plugin);
    });

    it("preserves object types with their fields", () => {
      context.startWork(
        DocumentNode.fromSource(/* GraphQL */ `
          type User {
            id: ID!
            name: String!
            age: Int
          }

          type Query {
            me: User
          }
        `)
      );

      const {
        appsync: { schema },
      } = generateSchema(plugin, context);

      expect(schema).toContain("type User");
      expect(schema).toContain("id: ID!");
      expect(schema).toContain("name: String!");
      expect(schema).toContain("age: Int");
    });

    it("preserves enum types", () => {
      context.startWork(
        DocumentNode.fromSource(/* GraphQL */ `
          enum Role {
            ADMIN
            USER
            GUEST
          }

          type Query {
            role: Role
          }
        `)
      );

      const {
        appsync: { schema },
      } = generateSchema(plugin, context);

      expect(schema).toContain("enum Role");
      expect(schema).toContain("ADMIN");
      expect(schema).toContain("USER");
      expect(schema).toContain("GUEST");
    });

    it("preserves union types", () => {
      context.startWork(
        DocumentNode.fromSource(/* GraphQL */ `
          type Cat {
            name: String!
          }

          type Dog {
            name: String!
          }

          union Pet = Cat | Dog

          type Query {
            pet: Pet
          }
        `)
      );

      const {
        appsync: { schema },
      } = generateSchema(plugin, context);

      expect(schema).toContain("union Pet = Cat | Dog");
    });

    it("preserves interface types", () => {
      context.startWork(
        DocumentNode.fromSource(/* GraphQL */ `
          interface Node {
            id: ID!
          }

          type User implements Node {
            id: ID!
            name: String!
          }

          type Query {
            me: User
          }
        `)
      );

      const {
        appsync: { schema },
      } = generateSchema(plugin, context);

      expect(schema).toContain("interface Node");
      expect(schema).toContain("type User implements Node");
    });

    it("preserves input types", () => {
      context.startWork(
        DocumentNode.fromSource(/* GraphQL */ `
          input CreateUserInput {
            name: String!
            email: String!
          }

          type Query {
            me: String
          }
        `)
      );

      const {
        appsync: { schema },
      } = generateSchema(plugin, context);

      expect(schema).toContain("input CreateUserInput");
      expect(schema).toContain("name: String!");
      expect(schema).toContain("email: String!");
    });

    it("preserves Query and Mutation types", () => {
      context.startWork(
        DocumentNode.fromSource(/* GraphQL */ `
          type User {
            id: ID!
          }

          type Query {
            me: User
            users: [User!]!
          }

          type Mutation {
            createUser(name: String!): User
          }
        `)
      );

      const {
        appsync: { schema },
      } = generateSchema(plugin, context);

      expect(schema).toContain("type Query");
      expect(schema).toContain("me: User");
      expect(schema).toContain("users: [User!]!");
      expect(schema).toContain("type Mutation");
      expect(schema).toContain("createUser(name: String!): User");
    });

    it.skip("preserves field descriptions", () => {
      context.startWork(
        DocumentNode.fromSource(/* GraphQL */ `
          type User {
            "The unique identifier"
            id: ID!
            "The user display name"
            name: String!
          }
          type Query {
            me: User
          }
        `)
      );

      const {
        appsync: { schema },
      } = generateSchema(plugin, context);

      expect(schema).toContain("The unique identifier");
      expect(schema).toContain("The user display name");
    });

    it.skip("preserves type descriptions", () => {
      context.startWork(
        DocumentNode.fromSource(/* GraphQL */ `
          "A platform user"
          type User {
            id: ID!
          }
          type Query {
            me: User
          }
        `)
      );

      const {
        appsync: { schema },
      } = generateSchema(plugin, context);

      expect(schema).toContain("A platform user");
    });
  });

  describe("complex schemas", () => {
    let plugin: AppSyncSchemaGeneratorPlugin;
    let context: TransformerContext;

    beforeAll(() => {
      context = new TransformerContext();
      plugin = new AppSyncSchemaGeneratorPlugin(context);

      context.registerPlugin(new ScalarsPlugin(context));
      context.registerPlugin(new AppSyncUtilsPlugin(context));
      context.registerPlugin(plugin);
    });

    it("handles multiple scalar replacements across types", () => {
      context.startWork(
        DocumentNode.fromSource(/* GraphQL */ `
          type User {
            id: UUID!
            email: EmailAddress!
            createdAt: DateTime!
            updatedAt: DateTime!
          }

          type Query {
            me: User
          }
        `)
      );

      const {
        appsync: { schema },
      } = generateSchema(plugin, context);

      expect(schema).toContain("id: ID!");
      expect(schema).toContain("email: AWSEmail!");
      expect(schema).toContain("createdAt: AWSDateTime!");
      expect(schema).toContain("updatedAt: AWSDateTime!");

      expect(schema).not.toContain("UUID");
      expect(schema).not.toContain("EmailAddress");
      expect(schema).not.toContain(": DateTime");
    });

    it("handles types with interfaces, enums, and scalar replacements", () => {
      context.startWork(
        DocumentNode.fromSource(/* GraphQL */ `
          interface Timestamped {
            createdAt: DateTime
            updatedAt: DateTime
          }

          enum Role {
            ADMIN
            USER
          }

          type User implements Timestamped {
            id: UUID!
            name: String!
            role: Role!
            createdAt: DateTime
            updatedAt: DateTime
          }

          type Query {
            me: User
          }
        `)
      );

      const {
        appsync: { schema },
      } = generateSchema(plugin, context);

      expect(schema).toContain("interface Timestamped");
      expect(schema).toContain("type User implements Timestamped");
      expect(schema).toContain("enum Role");
      expect(schema).toContain("id: ID!");
      expect(schema).toContain("role: Role!");
      expect(schema).not.toContain("UUID");
    });

    it("handles union types with scalar replacement in member types", () => {
      context.startWork(
        DocumentNode.fromSource(/* GraphQL */ `
          type OrderPayload {
            orderId: UUID!
          }

          type ReviewPayload {
            reviewId: UUID!
            createdAt: DateTime
          }

          union NotificationPayload = OrderPayload | ReviewPayload

          type Query {
            payload: NotificationPayload
          }
        `)
      );

      const {
        appsync: { schema },
      } = generateSchema(plugin, context);

      expect(schema).toContain("union NotificationPayload = OrderPayload | ReviewPayload");
      expect(schema).toContain("orderId: ID!");
      expect(schema).toContain("reviewId: ID!");
      expect(schema).toContain("createdAt: AWSDateTime");
    });

    it("handles input types with scalar replacements", () => {
      context.startWork(
        DocumentNode.fromSource(/* GraphQL */ `
          input CreateUserInput {
            email: EmailAddress!
            birthDate: DateTime
          }

          input DateRangeFilter {
            start: DateTime!
            end: DateTime!
          }

          type Query {
            users: String
          }
        `)
      );

      const {
        appsync: { schema },
      } = generateSchema(plugin, context);

      expect(schema).toContain("email: AWSEmail!");
      expect(schema).toContain("birthDate: AWSDateTime");
      expect(schema).toContain("start: AWSDateTime!");
      expect(schema).toContain("end: AWSDateTime!");
    });

    it("handles nested list types with scalar replacement", () => {
      context.startWork(
        DocumentNode.fromSource(/* GraphQL */ `
          type Group {
            memberIds: [UUID!]!
            optionalIds: [UUID]
          }

          type Query {
            group: Group
          }
        `)
      );

      const {
        appsync: { schema },
      } = generateSchema(plugin, context);

      expect(schema).toContain("memberIds: [ID!]!");
      expect(schema).toContain("optionalIds: [ID]");
    });

    it("strips all non-AWS directives while replacing scalars", () => {
      context.startWork(
        DocumentNode.fromSource(/* GraphQL */ `
          directive @model on OBJECT
          directive @readOnly on FIELD_DEFINITION
          directive @constraint(maxLength: Int) on FIELD_DEFINITION

          type User @model @aws_api_key {
            id: UUID!
            email: EmailAddress! @constraint(maxLength: 320)
            createdAt: DateTime! @readOnly
            name: String! @aws_api_key
          }
          type Query {
            me: User
          }
        `)
      );

      const {
        appsync: { schema },
      } = generateSchema(plugin, context);

      expect(schema).toContain("type User");
      expect(schema).toContain("@aws_api_key");
      expect(schema).toContain("id: ID!");
      expect(schema).toContain("email: AWSEmail!");
      expect(schema).toContain("createdAt: AWSDateTime!");
      expect(schema).not.toContain("@model");
      expect(schema).not.toContain("@readOnly");
      expect(schema).not.toContain("@constraint");
      expect(schema).not.toContain("UUID");
      expect(schema).not.toContain("EmailAddress");
    });
  });

  describe("output", () => {
    let plugin: AppSyncSchemaGeneratorPlugin;
    let context: TransformerContext;

    beforeAll(() => {
      context = new TransformerContext();
      plugin = new AppSyncSchemaGeneratorPlugin(context);
      context.registerPlugin(plugin);
    });

    it("returns the generated schema as a printable string", () => {
      context.startWork(
        DocumentNode.fromSource(/* GraphQL */ `
          type User {
            id: ID!
          }
          type Query {
            me: User
          }
        `)
      );

      const {
        appsync: { schema },
      } = generateSchema(plugin, context);

      expect(typeof schema).toBe("string");
      expect(schema.length).toBeGreaterThan(0);
    });

    it("produces valid GraphQL SDL", () => {
      context.startWork(
        DocumentNode.fromSource(/* GraphQL */ `
          scalar DateTime
          scalar UUID
          enum Role {
            ADMIN
            USER
          }
          interface Node {
            id: ID!
          }
          type User implements Node {
            id: ID!
            name: String!
            role: Role!
            createdAt: DateTime
          }
          input CreateUserInput {
            name: String!
          }
          type Query {
            me: User
          }
        `)
      );

      const {
        appsync: { schema },
      } = generateSchema(plugin, context);

      // The output should be parseable as valid GraphQL
      expect(() => DocumentNode.fromSource(schema)).not.toThrow();
    });

    it("excludes scalar and directive definitions from output", () => {
      context.startWork(
        DocumentNode.fromSource(/* GraphQL */ `
          scalar DateTime
          scalar UUID
          directive @model on OBJECT
          directive @readOnly on FIELD_DEFINITION

          type User {
            id: ID!
          }

          type Query {
            me: User
          }
        `)
      );

      const {
        appsync: { schema },
      } = generateSchema(plugin, context);

      expect(schema).not.toMatch(/^scalar /m);
      expect(schema).not.toMatch(/^directive /m);
    });

    it("resets local document between runs", () => {
      context.startWork(
        DocumentNode.fromSource(/* GraphQL */ `
          type User {
            id: ID!
          }
          type Query {
            me: User
          }
        `)
      );

      generateSchema(plugin, context);
      context.finishWork();

      context.startWork(
        DocumentNode.fromSource(/* GraphQL */ `
          type Product {
            id: ID!
          }
          type Query {
            product: Product
          }
        `)
      );

      const {
        appsync: { schema },
      } = generateSchema(plugin, context);

      // Second run should not contain types from first run
      expect(schema).not.toContain("type User");
      expect(schema).toContain("type Product");
    });
  });
});
