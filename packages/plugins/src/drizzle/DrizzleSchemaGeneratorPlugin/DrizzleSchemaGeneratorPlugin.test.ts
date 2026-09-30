import { beforeAll, describe, expect, it } from "vitest";
import { TransformerContext } from "@gqlbase/core";
import { DocumentNode, ObjectNode } from "@gqlbase/core/definition";
import { ScalarsPlugin, UtilitiesPlugin } from "@gqlbase/core/plugins";
import { DrizzleSchemaGeneratorPlugin } from "./DrizzleSchemaGeneratorPlugin.js";

const generateSchema = (
  plugin: DrizzleSchemaGeneratorPlugin,
  context: TransformerContext,
  schema: string,
  nodeNames: string[]
) => {
  context.finishWork();
  context.startWork(DocumentNode.fromSource(schema));

  plugin.before();

  for (const name of nodeNames) {
    const node = context.document.getNode(name);
    if (node && plugin.match(node)) {
      plugin.generate(node);
    }
  }

  const result = plugin.output() as { drizzleSchema: string };
  return result.drizzleSchema;
};

describe("DrizzleSchemaGeneratorPlugin", () => {
  describe("enum generation", () => {
    let plugin: DrizzleSchemaGeneratorPlugin;
    let context: TransformerContext;

    beforeAll(() => {
      context = new TransformerContext();
      plugin = new DrizzleSchemaGeneratorPlugin(context, { emitOutput: true });
      context.registerPlugin(plugin);
    });

    it("generates pgEnum for a simple enum", () => {
      const output = generateSchema(
        plugin,
        context,
        /* GraphQL */ `
          enum UserRole {
            ADMIN
            USER
          }
          type Query {
            me: String
          }
        `,
        ["UserRole"]
      );

      expect(output).toContain(
        'export const userRoleEnum = pgEnum("user_role_enum", ["ADMIN", "USER"])'
      );
    });

    it("generates pgEnum with single value", () => {
      const output = generateSchema(
        plugin,
        context,
        /* GraphQL */ `
          enum Status {
            ACTIVE
          }
          type Query {
            me: String
          }
        `,
        ["Status"]
      );

      expect(output).toContain('export const statusEnum = pgEnum("status_enum", ["ACTIVE"])');
    });
  });

  describe("scalar field mapping", () => {
    let plugin: DrizzleSchemaGeneratorPlugin;
    let context: TransformerContext;

    beforeAll(() => {
      context = new TransformerContext();
      const scalars = new ScalarsPlugin(context);
      context.registerPlugin(scalars);
      plugin = new DrizzleSchemaGeneratorPlugin(context, { emitOutput: true });
      context.registerPlugin(plugin);
    });

    it("maps ID! to uuid()", () => {
      const output = generateSchema(
        plugin,
        context,
        /* GraphQL */ `
          type User @model {
            id: ID!
          }
          type Query {
            me: User
          }
        `,
        ["User"]
      );

      expect(output).toContain('id: uuid("id")');
    });

    it("maps String! to text()", () => {
      const output = generateSchema(
        plugin,
        context,
        /* GraphQL */ `
          type User @model {
            name: String!
          }
          type Query {
            me: User
          }
        `,
        ["User"]
      );

      expect(output).toContain('name: text("name").notNull()');
    });

    it("maps Int! to integer()", () => {
      const output = generateSchema(
        plugin,
        context,
        /* GraphQL */ `
          type User @model {
            age: Int!
          }
          type Query {
            me: User
          }
        `,
        ["User"]
      );

      expect(output).toContain('age: integer("age").notNull()');
    });

    it("maps Float! to doublePrecision()", () => {
      const output = generateSchema(
        plugin,
        context,
        /* GraphQL */ `
          type User @model {
            score: Float!
          }
          type Query {
            me: User
          }
        `,
        ["User"]
      );

      expect(output).toContain('score: doublePrecision("score").notNull()');
    });

    it("maps Boolean! to boolean()", () => {
      const output = generateSchema(
        plugin,
        context,
        /* GraphQL */ `
          type User @model {
            active: Boolean!
          }
          type Query {
            me: User
          }
        `,
        ["User"]
      );

      expect(output).toContain('active: boolean("active").notNull()');
    });

    it("maps UUID! to uuid()", () => {
      const output = generateSchema(
        plugin,
        context,
        /* GraphQL */ `
          type User @model {
            externalId: UUID!
          }
          type Query {
            me: User
          }
        `,
        ["User"]
      );

      expect(output).toContain('externalId: uuid("external_id").notNull()');
    });

    it("maps DateTime! to timestamp()", () => {
      const output = generateSchema(
        plugin,
        context,
        /* GraphQL */ `
          type User @model {
            loginAt: DateTime!
          }
          type Query {
            me: User
          }
        `,
        ["User"]
      );

      expect(output).toContain('loginAt: timestamp("login_at").notNull()');
    });

    it("maps Date to date()", () => {
      const output = generateSchema(
        plugin,
        context,
        /* GraphQL */ `
          type User @model {
            birthday: Date
          }
          type Query {
            me: User
          }
        `,
        ["User"]
      );

      expect(output).toContain('birthday: date("birthday")');
    });

    it("maps JSON! to json()", () => {
      const output = generateSchema(
        plugin,
        context,
        /* GraphQL */ `
          type User @model {
            metadata: JSON!
          }
          type Query {
            me: User
          }
        `,
        ["User"]
      );

      expect(output).toContain('metadata: json("metadata").notNull()');
    });

    it("maps URL to text()", () => {
      const output = generateSchema(
        plugin,
        context,
        /* GraphQL */ `
          type User @model {
            website: URL
          }
          type Query {
            me: User
          }
        `,
        ["User"]
      );

      expect(output).toContain('website: text("website")');
    });

    it("maps EmailAddress to text()", () => {
      const output = generateSchema(
        plugin,
        context,
        /* GraphQL */ `
          type User @model {
            email: EmailAddress
          }
          type Query {
            me: User
          }
        `,
        ["User"]
      );

      expect(output).toContain('email: text("email")');
    });
  });

  describe("nullability", () => {
    let plugin: DrizzleSchemaGeneratorPlugin;
    let context: TransformerContext;

    beforeAll(() => {
      context = new TransformerContext();
      plugin = new DrizzleSchemaGeneratorPlugin(context, { emitOutput: true });
      context.registerPlugin(plugin);
    });

    it("adds .notNull() for non-null fields", () => {
      const output = generateSchema(
        plugin,
        context,
        /* GraphQL */ `
          type User @model {
            name: String!
          }
          type Query {
            me: User
          }
        `,
        ["User"]
      );

      expect(output).toContain('name: text("name").notNull()');
    });

    it("does not add .notNull() for nullable fields", () => {
      const output = generateSchema(
        plugin,
        context,
        /* GraphQL */ `
          type User @model {
            bio: String
          }
          type Query {
            me: User
          }
        `,
        ["User"]
      );

      expect(output).toContain('bio: text("bio")');
      expect(output).not.toContain("notNull");
    });
  });

  describe("semantic nullability", () => {
    let plugin: DrizzleSchemaGeneratorPlugin;
    let context: TransformerContext;

    beforeAll(() => {
      context = new TransformerContext();
      plugin = new DrizzleSchemaGeneratorPlugin(context, { emitOutput: true });
      context.registerPlugin(plugin);
    });

    it("adds .notNull() for @semanticNonNull fields", () => {
      const output = generateSchema(
        plugin,
        context,
        /* GraphQL */ `
          type User @model {
            name: String @semanticNonNull
          }
          type Query {
            me: User
          }
        `,
        ["User"]
      );

      expect(output).toContain('name: text("name").notNull()');
    });

    it("keeps nullable when field has no @semanticNonNull and no !", () => {
      const output = generateSchema(
        plugin,
        context,
        /* GraphQL */ `
          type User @model {
            bio: String
          }
          type Query {
            me: User
          }
        `,
        ["User"]
      );

      expect(output).toContain('bio: text("bio")');
      expect(output).not.toContain("notNull");
    });
  });

  describe("primary key and defaults", () => {
    let plugin: DrizzleSchemaGeneratorPlugin;
    let context: TransformerContext;

    beforeAll(() => {
      context = new TransformerContext();
      const scalars = new ScalarsPlugin(context);
      context.registerPlugin(scalars);
      plugin = new DrizzleSchemaGeneratorPlugin(context, { emitOutput: true });
      context.registerPlugin(plugin);
    });

    it("generates primaryKey().defaultRandom() for id: UUID!", () => {
      const output = generateSchema(
        plugin,
        context,
        /* GraphQL */ `
          type User @model {
            id: UUID!
          }
          type Query {
            me: User
          }
        `,
        ["User"]
      );

      expect(output).toContain('id: uuid("id").primaryKey().defaultRandom()');
    });
  });

  describe("array fields", () => {
    let plugin: DrizzleSchemaGeneratorPlugin;
    let context: TransformerContext;

    beforeAll(() => {
      context = new TransformerContext();
      plugin = new DrizzleSchemaGeneratorPlugin(context, { emitOutput: true });
      context.registerPlugin(plugin);
    });

    it("generates .array() for [String!]!", () => {
      const output = generateSchema(
        plugin,
        context,
        /* GraphQL */ `
          type User @model {
            tags: [String!]!
          }
          type Query {
            me: User
          }
        `,
        ["User"]
      );

      expect(output).toContain('tags: text("tags").array().notNull()');
    });

    it("generates .array() without .notNull() for [String!]", () => {
      const output = generateSchema(
        plugin,
        context,
        /* GraphQL */ `
          type User @model {
            tags: [String!]
          }
          type Query {
            me: User
          }
        `,
        ["User"]
      );

      expect(output).toContain('tags: text("tags").array()');
      expect(output).not.toContain("notNull");
    });

    it("generates enum .array() for [Role!]!", () => {
      const output = generateSchema(
        plugin,
        context,
        /* GraphQL */ `
          enum Role {
            ADMIN
            USER
          }
          type User @model {
            roles: [Role!]!
          }
          type Query {
            me: User
          }
        `,
        ["Role", "User"]
      );

      expect(output).toContain('roles: roleEnum("roles").array().notNull()');
    });
  });

  describe("enum field reference", () => {
    let plugin: DrizzleSchemaGeneratorPlugin;
    let context: TransformerContext;

    beforeAll(() => {
      context = new TransformerContext();
      plugin = new DrizzleSchemaGeneratorPlugin(context, { emitOutput: true });
      context.registerPlugin(plugin);
    });

    it("references generated pgEnum for enum fields", () => {
      const output = generateSchema(
        plugin,
        context,
        /* GraphQL */ `
          enum Status {
            ACTIVE
            INACTIVE
          }
          type User @model {
            status: Status!
          }
          type Query {
            me: User
          }
        `,
        ["Status", "User"]
      );

      expect(output).toContain(
        'export const statusEnum = pgEnum("status_enum", ["ACTIVE", "INACTIVE"])'
      );
      expect(output).toContain('status: statusEnum("status").notNull()');
    });
  });

  describe("nested value types", () => {
    let plugin: DrizzleSchemaGeneratorPlugin;
    let context: TransformerContext;

    beforeAll(() => {
      context = new TransformerContext();
      plugin = new DrizzleSchemaGeneratorPlugin(context, { emitOutput: true });
      context.registerPlugin(plugin);
    });

    it("generates jsonb().$type<T>() for non-@model object types", () => {
      const output = generateSchema(
        plugin,
        context,
        /* GraphQL */ `
          type Money {
            amount: String!
            currency: String!
          }
          type Product @model {
            price: Money!
          }
          type Query {
            me: String
          }
        `,
        ["Money", "Product"]
      );

      expect(output).toContain('price: json("price").$type<Money>().notNull()');
    });

    it("does not generate a table for non-@model object types", () => {
      const output = generateSchema(
        plugin,
        context,
        /* GraphQL */ `
          type Money {
            amount: String!
            currency: String!
          }
          type Product @model {
            price: Money!
          }
          type Query {
            me: String
          }
        `,
        ["Money", "Product"]
      );

      expect(output).not.toContain('pgTable("moneys"');
      expect(output).not.toContain('pgTable("money"');
      expect(output).toContain('pgTable("products"');
    });
  });

  describe("field skip logic", () => {
    let plugin: DrizzleSchemaGeneratorPlugin;
    let context: TransformerContext;

    beforeAll(() => {
      context = new TransformerContext();
      const utils = new UtilitiesPlugin(context);
      context.registerPlugin(utils);
      plugin = new DrizzleSchemaGeneratorPlugin(context, { emitOutput: true });
      context.registerPlugin(plugin);
    });

    it("excludes @clientOnly fields", () => {
      const output = generateSchema(
        plugin,
        context,
        /* GraphQL */ `
          type User @model {
            name: String!
            fullName: String @clientOnly
          }
          type Query {
            me: User
          }
        `,
        ["User"]
      );

      expect(output).toContain('name: text("name")');
      expect(output).not.toContain("fullName");
      expect(output).not.toContain("full_name");
    });

    it("includes @serverOnly fields", () => {
      const output = generateSchema(
        plugin,
        context,
        /* GraphQL */ `
          type User @model {
            name: String!
            passwordHash: String! @serverOnly
          }
          type Query {
            me: User
          }
        `,
        ["User"]
      );

      expect(output).toContain('passwordHash: text("password_hash").notNull()');
    });

    it("includes @readOnly fields", () => {
      const output = generateSchema(
        plugin,
        context,
        /* GraphQL */ `
          type User @model {
            name: String!
            createdAt: String @readOnly
          }
          type Query {
            me: User
          }
        `,
        ["User"]
      );

      expect(output).toContain('createdAt: text("created_at")');
    });

    it("excludes @hasOne relation fields", () => {
      const output = generateSchema(
        plugin,
        context,
        /* GraphQL */ `
          type Profile @model {
            bio: String
          }
          type User @model {
            name: String!
            profile: Profile @hasOne
          }
          type Query {
            me: User
          }
        `,
        ["User"]
      );

      expect(output).toContain('name: text("name")');
    });

    it("excludes @hasMany relation fields", () => {
      const output = generateSchema(
        plugin,
        context,
        /* GraphQL */ `
          type Post @model {
            title: String!
          }
          type User @model {
            name: String!
            posts: [Post!]! @hasMany
          }
          type Query {
            me: User
          }
        `,
        ["User"]
      );

      expect(output).toContain('name: text("name")');
    });

    it("excludes @belongsTo relation fields", () => {
      const output = generateSchema(
        plugin,
        context,
        /* GraphQL */ `
          type User @model {
            name: String!
          }
          type Post @model {
            title: String!
            author: User @belongsTo
          }
          type Query {
            me: String
          }
        `,
        ["Post"]
      );

      expect(output).toContain('title: text("title")');
    });
  });

  describe("table naming", () => {
    let plugin: DrizzleSchemaGeneratorPlugin;
    let context: TransformerContext;

    beforeAll(() => {
      context = new TransformerContext();
      plugin = new DrizzleSchemaGeneratorPlugin(context, { emitOutput: true });
      context.registerPlugin(plugin);
    });

    it("pluralizes and snake_cases type name for table", () => {
      const output = generateSchema(
        plugin,
        context,
        /* GraphQL */ `
          type ProductVariant @model {
            name: String!
          }
          type Query {
            me: String
          }
        `,
        ["ProductVariant"]
      );

      expect(output).toContain('export const productVariants = pgTable("product_variants"');
    });

    it("pluralizes simple type names", () => {
      const output = generateSchema(
        plugin,
        context,
        /* GraphQL */ `
          type User @model {
            name: String!
          }
          type Query {
            me: String
          }
        `,
        ["User"]
      );

      expect(output).toContain('export const users = pgTable("users"');
    });
  });

  describe("column naming", () => {
    let plugin: DrizzleSchemaGeneratorPlugin;
    let context: TransformerContext;

    beforeAll(() => {
      context = new TransformerContext();
      plugin = new DrizzleSchemaGeneratorPlugin(context, { emitOutput: true });
      context.registerPlugin(plugin);
    });

    it("uses camelCase JS property with snake_case DB column name", () => {
      const output = generateSchema(
        plugin,
        context,
        /* GraphQL */ `
          type User @model {
            firstName: String!
            lastName: String!
          }
          type Query {
            me: String
          }
        `,
        ["User"]
      );

      expect(output).toContain('firstName: text("first_name").notNull()');
      expect(output).toContain('lastName: text("last_name").notNull()');
    });

    it("keeps single-word columns as-is in DB name", () => {
      const output = generateSchema(
        plugin,
        context,
        /* GraphQL */ `
          type User @model {
            name: String!
          }
          type Query {
            me: String
          }
        `,
        ["User"]
      );

      expect(output).toContain('name: text("name").notNull()');
    });
  });

  describe("non-@model types skipped", () => {
    let plugin: DrizzleSchemaGeneratorPlugin;
    let context: TransformerContext;

    beforeAll(() => {
      context = new TransformerContext();
      plugin = new DrizzleSchemaGeneratorPlugin(context, { emitOutput: true });
      context.registerPlugin(plugin);
    });

    it("does not generate tables for types without @model", () => {
      const output = generateSchema(
        plugin,
        context,
        /* GraphQL */ `
          type GeoPoint {
            latitude: Float!
            longitude: Float!
          }
          type Query {
            me: String
          }
        `,
        ["GeoPoint"]
      );

      expect(output).not.toContain("pgTable");
    });
  });

  describe("union/interface/input types skipped", () => {
    let plugin: DrizzleSchemaGeneratorPlugin;
    let context: TransformerContext;

    beforeAll(() => {
      context = new TransformerContext();
      plugin = new DrizzleSchemaGeneratorPlugin(context, { emitOutput: true });
      context.registerPlugin(plugin);
    });

    it("does not generate tables for union types", () => {
      const output = generateSchema(
        plugin,
        context,
        /* GraphQL */ `
          type A {
            x: String
          }
          type B {
            y: String
          }
          union AB = A | B
          type Query {
            me: String
          }
        `,
        ["A", "B", "AB"]
      );

      expect(output).not.toContain("pgTable");
    });

    it("does not generate tables for interface types", () => {
      const output = generateSchema(
        plugin,
        context,
        /* GraphQL */ `
          interface Node {
            id: ID!
          }
          type Query {
            me: String
          }
        `,
        ["Node"]
      );

      expect(output).not.toContain("pgTable");
    });

    it("does not generate tables for input types", () => {
      const output = generateSchema(
        plugin,
        context,
        /* GraphQL */ `
          input CreateUserInput {
            name: String!
          }
          type Query {
            me: String
          }
        `,
        ["CreateUserInput"]
      );

      expect(output).not.toContain("pgTable");
    });
  });

  describe("match filtering", () => {
    let plugin: DrizzleSchemaGeneratorPlugin;
    let context: TransformerContext;

    beforeAll(() => {
      context = new TransformerContext();
      plugin = new DrizzleSchemaGeneratorPlugin(context, { emitOutput: true });
      context.registerPlugin(plugin);
    });

    it("does not match Query type", () => {
      context.finishWork();
      context.startWork(
        DocumentNode.fromSource(/* GraphQL */ `
          type Query {
            me: String
          }
        `)
      );

      const queryNode = context.document.getNode("Query") as ObjectNode;
      expect(plugin.match(queryNode)).toBe(false);
    });

    it("does not match Mutation type", () => {
      context.finishWork();
      context.startWork(
        DocumentNode.fromSource(/* GraphQL */ `
          type Mutation {
            doSomething: String
          }
          type Query {
            me: String
          }
        `)
      );

      const mutationNode = context.document.getNode("Mutation") as ObjectNode;
      expect(plugin.match(mutationNode)).toBe(false);
    });
  });

  describe("custom scalar mapping", () => {
    let plugin: DrizzleSchemaGeneratorPlugin;
    let context: TransformerContext;

    beforeAll(() => {
      context = new TransformerContext();
      plugin = new DrizzleSchemaGeneratorPlugin(context, {
        emitOutput: true,
        scalarMap: { Decimal: "numeric" },
      });
      context.registerPlugin(plugin);
    });

    it("uses scalarMap option for custom scalars", () => {
      const output = generateSchema(
        plugin,
        context,
        /* GraphQL */ `
          scalar Decimal @gqlbase_typehint(type: string)
          type Product @model {
            price: Decimal!
          }
          type Query {
            me: String
          }
        `,
        ["Product"]
      );

      expect(output).toContain('price: numeric("price").notNull()');
    });

    it("falls back to @gqlbase_typehint for unmapped custom scalars", () => {
      const contextNoMap = new TransformerContext();
      const pluginNoMap = new DrizzleSchemaGeneratorPlugin(contextNoMap, { emitOutput: true });
      contextNoMap.registerPlugin(pluginNoMap);

      const output = generateSchema(
        pluginNoMap,
        contextNoMap,
        /* GraphQL */ `
          scalar Decimal @gqlbase_typehint(type: string)
          type Product @model {
            price: Decimal!
          }
          type Query {
            me: String
          }
        `,
        ["Product"]
      );

      expect(output).toContain('price: text("price").notNull()');
    });
  });

  describe("import generation", () => {
    let plugin: DrizzleSchemaGeneratorPlugin;
    let context: TransformerContext;

    beforeAll(() => {
      context = new TransformerContext();
      const scalars = new ScalarsPlugin(context);
      context.registerPlugin(scalars);
      plugin = new DrizzleSchemaGeneratorPlugin(context, { emitOutput: true });
      context.registerPlugin(plugin);
    });

    it("includes pgTable import when tables are generated", () => {
      const output = generateSchema(
        plugin,
        context,
        /* GraphQL */ `
          type User @model {
            name: String!
          }
          type Query {
            me: User
          }
        `,
        ["User"]
      );

      expect(output).toContain("pgTable");
      expect(output).toContain('from "drizzle-orm/pg-core"');
    });

    it("includes pgEnum import when enums are generated", () => {
      const output = generateSchema(
        plugin,
        context,
        /* GraphQL */ `
          enum Role {
            ADMIN
          }
          type Query {
            me: String
          }
        `,
        ["Role"]
      );

      expect(output).toContain("pgEnum");
      expect(output).toContain('from "drizzle-orm/pg-core"');
    });

    it("includes only needed column type imports", () => {
      const output = generateSchema(
        plugin,
        context,
        /* GraphQL */ `
          type User @model {
            name: String!
            age: Int!
          }
          type Query {
            me: User
          }
        `,
        ["User"]
      );

      expect(output).toContain("text");
      expect(output).toContain("integer");
      expect(output).toContain("pgTable");
      expect(output).not.toContain("boolean");
      expect(output).not.toContain("timestamp");
    });
  });
});
