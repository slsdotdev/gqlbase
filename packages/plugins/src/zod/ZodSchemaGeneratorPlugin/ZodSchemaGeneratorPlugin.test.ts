import { beforeAll, describe, expect, it } from "vitest";
import { createTransformer, TransformerContext } from "@gqlbase/core";
import { DocumentNode } from "@gqlbase/core/definition";
import { ScalarsPlugin, UtilitiesPlugin } from "@gqlbase/core/plugins";
import { ZodSchemaGeneratorPlugin, zodSchemaGeneratorPlugin } from "./ZodSchemaGeneratorPlugin.js";

const generateSchemas = (
  plugin: ZodSchemaGeneratorPlugin,
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

  plugin.after();

  const result = plugin.output() as { zodSchemas: string };
  return result.zodSchemas;
};

describe("ZodSchemaGeneratorPlugin", () => {
  describe("enum generation", () => {
    let plugin: ZodSchemaGeneratorPlugin;
    let context: TransformerContext;

    beforeAll(() => {
      context = new TransformerContext();
      plugin = new ZodSchemaGeneratorPlugin(context, { emitOutput: true });
      context.registerPlugin(plugin);
    });

    it("generates z.enum for a simple enum", () => {
      const output = generateSchemas(
        plugin,
        context,
        /* GraphQL */ `
          enum UserRole {
            ADMIN
            USER
          }
          type Query {
            role: UserRole
          }
        `,
        ["UserRole"]
      );

      expect(output).toContain('export const UserRoleSchema = z.enum(["ADMIN", "USER"])');
    });

    it("generates z.enum with single value", () => {
      const output = generateSchemas(
        plugin,
        context,
        /* GraphQL */ `
          enum Status {
            ACTIVE
          }
          type Query {
            status: Status
          }
        `,
        ["Status"]
      );

      expect(output).toContain('export const StatusSchema = z.enum(["ACTIVE"])');
    });

    it("skips an enum nothing references", () => {
      const output = generateSchemas(
        plugin,
        context,
        /* GraphQL */ `
          enum Unused {
            A
          }
          type Query {
            me: String
          }
        `,
        ["Unused"]
      );

      expect(output).not.toContain("UnusedSchema");
    });

    it("skips an enum used only by a @serverOnly field", () => {
      const output = generateSchemas(
        plugin,
        context,
        /* GraphQL */ `
          enum Visibility {
            HIDDEN
          }
          type Post {
            id: ID!
            visibility: Visibility @serverOnly
          }
          type Query {
            post: Post
          }
        `,
        ["Visibility"]
      );

      expect(output).not.toContain("VisibilitySchema");
    });
  });

  describe("built-in scalar field mapping", () => {
    let plugin: ZodSchemaGeneratorPlugin;
    let context: TransformerContext;

    beforeAll(() => {
      context = new TransformerContext();
      plugin = new ZodSchemaGeneratorPlugin(context, { emitOutput: true });
      context.registerPlugin(plugin);
    });

    it("maps ID! to z.string()", () => {
      const output = generateSchemas(
        plugin,
        context,
        /* GraphQL */ `
          type User {
            id: ID!
          }
          type Query {
            me: User
          }
        `,
        ["User"]
      );

      expect(output).toContain("id: z.string()");
    });

    it("maps String! to z.string()", () => {
      const output = generateSchemas(
        plugin,
        context,
        /* GraphQL */ `
          type User {
            name: String!
          }
          type Query {
            me: User
          }
        `,
        ["User"]
      );

      expect(output).toContain("name: z.string()");
    });

    it("maps Int! to z.int()", () => {
      const output = generateSchemas(
        plugin,
        context,
        /* GraphQL */ `
          type User {
            age: Int!
          }
          type Query {
            me: User
          }
        `,
        ["User"]
      );

      expect(output).toContain("age: z.int()");
    });

    it("maps Float! to z.number()", () => {
      const output = generateSchemas(
        plugin,
        context,
        /* GraphQL */ `
          type User {
            score: Float!
          }
          type Query {
            me: User
          }
        `,
        ["User"]
      );

      expect(output).toContain("score: z.number()");
    });

    it("maps Boolean! to z.boolean()", () => {
      const output = generateSchemas(
        plugin,
        context,
        /* GraphQL */ `
          type User {
            active: Boolean!
          }
          type Query {
            me: User
          }
        `,
        ["User"]
      );

      expect(output).toContain("active: z.boolean()");
    });
  });

  describe("nullability", () => {
    let plugin: ZodSchemaGeneratorPlugin;
    let context: TransformerContext;

    beforeAll(() => {
      context = new TransformerContext();
      plugin = new ZodSchemaGeneratorPlugin(context, { emitOutput: true });
      context.registerPlugin(plugin);
    });

    it("wraps nullable field with .nullable().optional()", () => {
      const output = generateSchemas(
        plugin,
        context,
        /* GraphQL */ `
          type User {
            bio: String
          }
          type Query {
            me: User
          }
        `,
        ["User"]
      );

      expect(output).toContain("bio: z.string().nullable().optional()");
    });

    it("does not wrap non-null field", () => {
      const output = generateSchemas(
        plugin,
        context,
        /* GraphQL */ `
          type User {
            id: ID!
          }
          type Query {
            me: User
          }
        `,
        ["User"]
      );

      expect(output).toContain("id: z.string()");
      expect(output).not.toContain("id: z.string().nullable()");
    });
  });

  describe("semantic nullability", () => {
    let plugin: ZodSchemaGeneratorPlugin;
    let context: TransformerContext;

    beforeAll(() => {
      context = new TransformerContext();
      plugin = new ZodSchemaGeneratorPlugin(context, { emitOutput: true });
      context.registerPlugin(plugin);
    });

    it("generates non-nullable for fields with @semanticNonNull", () => {
      const output = generateSchemas(
        plugin,
        context,
        /* GraphQL */ `
          type User {
            name: String @semanticNonNull
          }
          type Query {
            me: User
          }
        `,
        ["User"]
      );

      expect(output).toContain("name: z.string()");
      expect(output).not.toContain("name: z.string().nullable()");
    });

    it("wraps list items with nullable when only list level is @semanticNonNull", () => {
      const output = generateSchemas(
        plugin,
        context,
        /* GraphQL */ `
          type User {
            tags: [String] @semanticNonNull
          }
          type Query {
            me: User
          }
        `,
        ["User"]
      );

      // level 0 non-null (directive), level 1 nullable (not specified)
      expect(output).toContain("tags: z.array(z.string().nullable())");
      expect(output).not.toContain("tags: z.array(z.string().nullable()).nullable()");
    });

    it("generates fully non-null list when all levels are @semanticNonNull", () => {
      const output = generateSchemas(
        plugin,
        context,
        /* GraphQL */ `
          type User {
            tags: [String] @semanticNonNull(levels: [0, 1])
          }
          type Query {
            me: User
          }
        `,
        ["User"]
      );

      expect(output).toContain("tags: z.array(z.string())");
      expect(output).not.toContain(".nullable()");
    });

    it("generates nullable list with non-null items for @semanticNonNull(levels: [1])", () => {
      const output = generateSchemas(
        plugin,
        context,
        /* GraphQL */ `
          type User {
            tags: [String] @semanticNonNull(levels: [1])
          }
          type Query {
            me: User
          }
        `,
        ["User"]
      );

      // level 0 nullable, level 1 non-null
      expect(output).toContain("tags: z.array(z.string()).nullable().optional()");
    });

    it("combines schema NonNull with @semanticNonNull on lists", () => {
      const output = generateSchemas(
        plugin,
        context,
        /* GraphQL */ `
          type User {
            tags: [String!] @semanticNonNull
          }
          type Query {
            me: User
          }
        `,
        ["User"]
      );

      // level 0 covered by @semanticNonNull, level 1 covered by String!
      expect(output).toContain("tags: z.array(z.string())");
      expect(output).not.toContain(".nullable()");
    });
  });

  describe("list types", () => {
    let plugin: ZodSchemaGeneratorPlugin;
    let context: TransformerContext;

    beforeAll(() => {
      context = new TransformerContext();
      plugin = new ZodSchemaGeneratorPlugin(context, { emitOutput: true });
      context.registerPlugin(plugin);
    });

    it("generates z.array for [String!]!", () => {
      const output = generateSchemas(
        plugin,
        context,
        /* GraphQL */ `
          type User {
            tags: [String!]!
          }
          type Query {
            me: User
          }
        `,
        ["User"]
      );

      expect(output).toContain("tags: z.array(z.string())");
    });

    it("generates nullable array for [String!]", () => {
      const output = generateSchemas(
        plugin,
        context,
        /* GraphQL */ `
          type User {
            tags: [String!]
          }
          type Query {
            me: User
          }
        `,
        ["User"]
      );

      expect(output).toContain("tags: z.array(z.string()).nullable().optional()");
    });

    it("generates array with nullable items for [String]!", () => {
      const output = generateSchemas(
        plugin,
        context,
        /* GraphQL */ `
          type User {
            tags: [String]!
          }
          type Query {
            me: User
          }
        `,
        ["User"]
      );

      expect(output).toContain("tags: z.array(z.string().nullable())");
    });

    it("generates fully nullable list for [String]", () => {
      const output = generateSchemas(
        plugin,
        context,
        /* GraphQL */ `
          type User {
            tags: [String]
          }
          type Query {
            me: User
          }
        `,
        ["User"]
      );

      expect(output).toContain("tags: z.array(z.string().nullable()).nullable().optional()");
    });
  });

  describe("constraint directive", () => {
    let plugin: ZodSchemaGeneratorPlugin;
    let context: TransformerContext;

    beforeAll(() => {
      context = new TransformerContext();
      const utilsPlugin = new UtilitiesPlugin(context);
      context.registerPlugin(utilsPlugin);
      plugin = new ZodSchemaGeneratorPlugin(context, { emitOutput: true });
      context.registerPlugin(plugin);
    });

    it("applies .min() and .max() for string @constraint", () => {
      const output = generateSchemas(
        plugin,
        context,
        /* GraphQL */ `
          type User {
            name: String! @constraint(min: 3, max: 50)
          }
          type Query {
            me: User
          }
        `,
        ["User"]
      );

      expect(output).toContain("name: z.string().min(3).max(50)");
    });

    it("applies .regex() for @constraint(pattern)", () => {
      const output = generateSchemas(
        plugin,
        context,
        /* GraphQL */ `
          type User {
            code: String! @constraint(pattern: "^[A-Z]+$")
          }
          type Query {
            me: User
          }
        `,
        ["User"]
      );

      expect(output).toContain("code: z.string().regex(/^[A-Z]+$/)");
    });

    it("applies min/max to Int fields", () => {
      const output = generateSchemas(
        plugin,
        context,
        /* GraphQL */ `
          type User {
            age: Int! @constraint(min: 0, max: 150)
          }
          type Query {
            me: User
          }
        `,
        ["User"]
      );

      expect(output).toContain("age: z.int().min(0).max(150)");
    });

    it("applies all constraints together on a string field", () => {
      const output = generateSchemas(
        plugin,
        context,
        /* GraphQL */ `
          type User {
            slug: String! @constraint(min: 1, max: 100, pattern: "^[a-z0-9-]+$")
          }
          type Query {
            me: User
          }
        `,
        ["User"]
      );

      expect(output).toContain("slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/)");
    });

    it("applies constraints before nullable wrapping", () => {
      const output = generateSchemas(
        plugin,
        context,
        /* GraphQL */ `
          type User {
            bio: String @constraint(max: 500)
          }
          type Query {
            me: User
          }
        `,
        ["User"]
      );

      expect(output).toContain("bio: z.string().max(500).nullable().optional()");
    });
  });

  describe("custom scalar mapping", () => {
    let plugin: ZodSchemaGeneratorPlugin;
    let context: TransformerContext;

    beforeAll(() => {
      context = new TransformerContext();
      const scalars = new ScalarsPlugin(context);
      context.registerPlugin(scalars);
      plugin = new ZodSchemaGeneratorPlugin(context, { emitOutput: true });
      context.registerPlugin(plugin);
    });

    it("maps DateTime to z.iso.datetime()", () => {
      const output = generateSchemas(
        plugin,
        context,
        /* GraphQL */ `
          type User {
            createdAt: DateTime!
          }
          type Query {
            me: User
          }
        `,
        ["User"]
      );

      expect(output).toContain("createdAt: z.iso.datetime()");
    });

    it("maps Date to z.iso.date()", () => {
      const output = generateSchemas(
        plugin,
        context,
        /* GraphQL */ `
          type User {
            birthday: Date!
          }
          type Query {
            me: User
          }
        `,
        ["User"]
      );

      expect(output).toContain("birthday: z.iso.date()");
    });

    it("maps Time to z.iso.time()", () => {
      const output = generateSchemas(
        plugin,
        context,
        /* GraphQL */ `
          type User {
            loginTime: Time!
          }
          type Query {
            me: User
          }
        `,
        ["User"]
      );

      expect(output).toContain("loginTime: z.iso.time()");
    });

    it("maps Timestamp to z.number()", () => {
      const output = generateSchemas(
        plugin,
        context,
        /* GraphQL */ `
          type User {
            lastSeen: Timestamp!
          }
          type Query {
            me: User
          }
        `,
        ["User"]
      );

      expect(output).toContain("lastSeen: z.number()");
    });

    it("maps UUID to z.guid({ version: 4 })", () => {
      const output = generateSchemas(
        plugin,
        context,
        /* GraphQL */ `
          type User {
            id: UUID!
          }
          type Query {
            me: User
          }
        `,
        ["User"]
      );

      expect(output).toContain("id: z.uuid()");
    });

    it("maps URL to z.url()", () => {
      const output = generateSchemas(
        plugin,
        context,
        /* GraphQL */ `
          type User {
            website: URL!
          }
          type Query {
            me: User
          }
        `,
        ["User"]
      );

      expect(output).toContain("website: z.url()");
    });

    it("maps EmailAddress to z.email()", () => {
      const output = generateSchemas(
        plugin,
        context,
        /* GraphQL */ `
          type User {
            email: EmailAddress!
          }
          type Query {
            me: User
          }
        `,
        ["User"]
      );

      expect(output).toContain("email: z.email()");
    });

    it("maps PhoneNumber to z.e164()", () => {
      const output = generateSchemas(
        plugin,
        context,
        /* GraphQL */ `
          type User {
            phone: PhoneNumber!
          }
          type Query {
            me: User
          }
        `,
        ["User"]
      );

      expect(output).toContain("phone: z.e164()");
    });

    it("maps IPAddress to z.ip()", () => {
      const output = generateSchemas(
        plugin,
        context,
        /* GraphQL */ `
          type User {
            ip: IPAddress!
          }
          type Query {
            me: User
          }
        `,
        ["User"]
      );

      expect(output).toContain("ip: z.ip()");
    });

    it("maps JSON to z.record(z.string(), z.unknown())", () => {
      const output = generateSchemas(
        plugin,
        context,
        /* GraphQL */ `
          type User {
            metadata: JSON!
          }
          type Query {
            me: User
          }
        `,
        ["User"]
      );

      expect(output).toContain("metadata: z.record(z.string(), z.unknown())");
    });
  });

  describe("object type references", () => {
    let plugin: ZodSchemaGeneratorPlugin;
    let context: TransformerContext;

    beforeAll(() => {
      context = new TransformerContext();
      plugin = new ZodSchemaGeneratorPlugin(context, { emitOutput: true });
      context.registerPlugin(plugin);
    });

    it("references enum schema by name", () => {
      const output = generateSchemas(
        plugin,
        context,
        /* GraphQL */ `
          enum UserRole {
            ADMIN
            USER
          }
          type User {
            role: UserRole!
          }
          type Query {
            me: User
          }
        `,
        ["UserRole", "User"]
      );

      expect(output).toContain("role: UserRoleSchema");
    });

    it("references another object type schema", () => {
      const output = generateSchemas(
        plugin,
        context,
        /* GraphQL */ `
          type Address {
            street: String!
          }
          type User {
            address: Address!
          }
          type Query {
            me: User
          }
        `,
        ["Address", "User"]
      );

      expect(output).toContain("address: AddressSchema");
    });
  });

  describe("object schemas follow the public schema", () => {
    let validators: string;

    beforeAll(() => {
      const output = createTransformer({
        plugins: [zodSchemaGeneratorPlugin()],
      }).transform(/* GraphQL */ `
        interface Entry {
          id: ID!
        }

        type Note implements Entry {
          id: ID!
          body: String!
          importRef: String @writeOnly
          deletedAt: String @serverOnly
          rating: Int @clientOnly
          audit: AuditRecord @serverOnly
        }

        type AuditRecord {
          actor: String!
        }

        type Secret implements Entry @serverOnly {
          id: ID!
          value: String!
        }

        type Query {
          entry(id: ID!): Entry
          note(id: ID!): Note
        }
      `);

      validators =
        output.files.find((file) => file.path === "zod/schema.validators.ts")?.content ?? "";
    });

    it("leaves out @serverOnly and @writeOnly fields, and keeps @clientOnly ones", () => {
      const note = validators.slice(validators.indexOf("export const NoteSchema"));

      expect(note).toContain("body: z.string()");
      expect(note).toContain("rating: z.int().nullable().optional()");
      expect(note).not.toContain("deletedAt");
      expect(note).not.toContain("importRef");
      expect(note).not.toContain("audit");
    });

    it("emits nothing for types only @serverOnly fields reach", () => {
      expect(validators).not.toContain("AuditRecordSchema");
    });

    it("emits nothing for a @serverOnly type, even one implementing a public interface", () => {
      expect(validators).toContain("export const EntrySchema");
      expect(validators).not.toContain("SecretSchema");
    });
  });

  describe("input object types are skipped by default", () => {
    let plugin: ZodSchemaGeneratorPlugin;
    let context: TransformerContext;

    beforeAll(() => {
      context = new TransformerContext();
      plugin = new ZodSchemaGeneratorPlugin(context, { emitOutput: true });
      context.registerPlugin(plugin);
    });

    it("match() returns false for input objects", () => {
      context.finishWork();
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

      const node = context.document.getNodeOrThrow("CreateUserInput");
      expect(node).toBeDefined();
      expect(plugin.match(node)).toBe(false);
    });

    it("does not emit a schema for input objects in the default path", () => {
      const output = generateSchemas(
        plugin,
        context,
        /* GraphQL */ `
          input CreateUserInput {
            name: String!
            email: String!
          }
          type Query {
            me: String
          }
        `,
        ["CreateUserInput"]
      );

      expect(output).not.toContain("CreateUserInputSchema");
    });
  });

  describe("model create/update schemas", () => {
    let validators: string;
    let createPost: string;
    let updatePost: string;

    beforeAll(() => {
      const output = createTransformer({
        plugins: [zodSchemaGeneratorPlugin()],
      }).transform(/* GraphQL */ `
        type Author @model {
          id: ID!
          name: String!
        }

        type Post @model {
          id: ID!
          title: String! @constraint(min: 3)
          body: String
          slug: String! @createOnly
          note: String @updateOnly
          importRef: String @writeOnly
          createdAt: String @readOnly
          createdBy: String @serverOnly
          readers: Int @clientOnly
          author: Author @belongsTo
          meta: PostMeta!
        }

        type PostMeta {
          words: Int! @constraint(min: 0)
          indexedAt: String @readOnly
          parent: PostMeta
        }

        type Draft @model(operations: [GET, LIST]) {
          id: ID!
          title: String!
        }
      `);

      validators =
        output.files.find((file) => file.path === "zod/schema.validators.ts")?.content ?? "";
      createPost = validators.slice(
        validators.indexOf("export const CreatePostInputSchema"),
        validators.indexOf("export const UpdatePostInputSchema")
      );
      updatePost = validators.slice(validators.indexOf("export const UpdatePostInputSchema"));
      updatePost = updatePost.slice(0, updatePost.indexOf("});"));
    });

    it("has exactly the fields of Create<Model>Input", () => {
      expect(createPost).toContain("title:");
      expect(createPost).toContain("body:");
      expect(createPost).toContain("slug:");
      expect(createPost).toContain("importRef:");
      expect(createPost).toContain("meta:");

      for (const name of ["note", "createdAt", "createdBy", "readers", "author", "authorId"]) {
        expect(createPost).not.toContain(`${name}:`);
      }
    });

    it("has exactly the fields of Update<Model>Input", () => {
      expect(updatePost).toContain("note:");
      expect(updatePost).toContain("importRef:");

      for (const name of ["slug", "createdAt", "createdBy", "readers", "author", "authorId"]) {
        expect(updatePost).not.toContain(`${name}:`);
      }
    });

    it("makes id optional on create and required on update", () => {
      expect(createPost).toContain("id: z.string().optional()");
      expect(updatePost).toMatch(/id: z\.string\(\),/);
    });

    it("keeps constraints, and rejects null on a required field on update", () => {
      expect(createPost).toContain("title: z.string().min(3),");
      expect(updatePost).toContain("title: z.string().min(3).optional()");
      expect(updatePost).toContain("body: z.string().nullable().optional()");
    });

    it("references the nested <Type>InputSchema, which follows <Type>Input", () => {
      const meta = validators.slice(validators.indexOf("export const PostMetaInputSchema"));

      expect(createPost).toContain("meta: PostMetaInputSchema");
      expect(updatePost).toContain("meta: PostMetaInputSchema.optional()");
      expect(meta).toContain("words: z.int().min(0)");
      expect(meta.slice(0, meta.indexOf("});"))).not.toContain("indexedAt");
    });

    it("wraps a nested input that refers back to itself in z.lazy", () => {
      expect(validators).toContain(
        "parent: z.lazy(() => PostMetaInputSchema).nullable().optional()"
      );
    });

    it("emits only the schemas of the inputs the model has", () => {
      expect(validators).toContain("export const DraftSchema");
      expect(validators).not.toContain("CreateDraftInputSchema");
      expect(validators).not.toContain("UpdateDraftInputSchema");
    });
  });

  describe("argument schema walker", () => {
    let plugin: ZodSchemaGeneratorPlugin;
    let context: TransformerContext;

    beforeAll(() => {
      context = new TransformerContext();
      plugin = new ZodSchemaGeneratorPlugin(context, {
        emitOutput: true,
        generateArgumentSchemas: true,
      });

      context.registerPlugin(plugin);
    });

    it("emits zod schemas for argument input types and their dependencies", () => {
      const output = generateSchemas(
        plugin,
        context,
        /* GraphQL */ `
          input PostFilterInput {
            title: StringFilterInput
            and: [PostFilterInput]
          }
          input StringFilterInput {
            eq: String
            in: [String]
          }
          type Post {
            id: ID!
          }
          type Query {
            listPosts(filter: PostFilterInput): [Post]
          }
        `,
        ["Post", "Query"]
      );

      expect(output).toContain("PostFilterInputSchema");
      expect(output).toContain("StringFilterInputSchema");
    });

    it("emits schemas for filter and orderBy on a parent that is not a model", () => {
      const output = generateSchemas(
        plugin,
        context,
        /* GraphQL */ `
          enum SortDirection {
            asc
            desc
          }
          input PriceFilterInput {
            amount: FloatFilterInput
            and: [PriceFilterInput!]
          }
          input PriceFieldFilterInput {
            exists: Boolean
            where: PriceFilterInput
          }
          input FloatFilterInput {
            lte: Float
            between: [Float!]
          }
          input ItemFilterInput {
            price: PriceFieldFilterInput
          }
          input ItemOrderByInput {
            name: SortDirection
          }
          type Item {
            name: String
          }
          type Viewer {
            items(filter: ItemFilterInput, orderBy: ItemOrderByInput): [Item!]
          }
          type Query {
            viewer: Viewer
          }
        `,
        ["Item", "Viewer", "Query"]
      );

      expect(output).toContain("ItemFilterInputSchema");
      expect(output).toContain("PriceFieldFilterInputSchema");
      expect(output).toContain("PriceFilterInputSchema");
      expect(output).toContain("ItemOrderByInputSchema");
      expect(output).toContain("SortDirectionSchema");
    });

    it("derives a hand-written Create<Model>Input from the model, once", () => {
      const output = createTransformer({
        plugins: [zodSchemaGeneratorPlugin({ generateArgumentSchemas: true })],
      }).transform(/* GraphQL */ `
        input CreateUserInput {
          name: String
        }

        type User @model {
          id: ID!
          name: String! @constraint(max: 20)
          secret: String @serverOnly
        }
      `);

      const validators =
        output.files.find((file) => file.path === "zod/schema.validators.ts")?.content ?? "";
      const create = validators.slice(validators.indexOf("export const CreateUserInputSchema"));

      expect(validators.match(/CreateUserInputSchema = z\.object/g)).toHaveLength(1);
      expect(create).toContain("name: z.string().max(20)");
      expect(create.slice(0, create.indexOf("});"))).not.toContain("secret");
    });
  });

  describe("union types", () => {
    let plugin: ZodSchemaGeneratorPlugin;
    let context: TransformerContext;

    beforeAll(() => {
      context = new TransformerContext();
      plugin = new ZodSchemaGeneratorPlugin(context, { emitOutput: true });
      context.registerPlugin(plugin);
    });

    it("generates z.union for union types", () => {
      const output = generateSchemas(
        plugin,
        context,
        /* GraphQL */ `
          type User {
            id: ID!
          }
          type Post {
            id: ID!
          }
          union SearchResult = User | Post
          type Query {
            search: SearchResult
          }
        `,
        ["User", "Post", "SearchResult"]
      );

      expect(output).toContain(
        "export const SearchResultSchema = z.union([UserSchema, PostSchema])"
      );
    });
  });

  describe("emission ordering", () => {
    let plugin: ZodSchemaGeneratorPlugin;
    let context: TransformerContext;

    beforeAll(() => {
      context = new TransformerContext();
      plugin = new ZodSchemaGeneratorPlugin(context, { emitOutput: true });
      context.registerPlugin(plugin);
    });

    it("emits a referenced enum before the object that references it", () => {
      const output = generateSchemas(
        plugin,
        context,
        /* GraphQL */ `
          type User {
            role: Role!
          }
          enum Role {
            ADMIN
            USER
          }
          type Query {
            me: User
          }
        `,
        ["User", "Role"]
      );

      const roleIdx = output.indexOf("export const RoleSchema");
      const userIdx = output.indexOf("export const UserSchema");
      expect(roleIdx).toBeGreaterThan(-1);
      expect(userIdx).toBeGreaterThan(-1);
      expect(roleIdx).toBeLessThan(userIdx);
    });

    it("emits a referenced object before the object that references it", () => {
      const output = generateSchemas(
        plugin,
        context,
        /* GraphQL */ `
          type User {
            address: Address!
          }
          type Address {
            street: String!
          }
          type Query {
            me: User
          }
        `,
        ["User", "Address"]
      );

      const addressIdx = output.indexOf("export const AddressSchema");
      const userIdx = output.indexOf("export const UserSchema");
      expect(addressIdx).toBeLessThan(userIdx);
    });

    it("emits union member schemas before the union itself", () => {
      const output = generateSchemas(
        plugin,
        context,
        /* GraphQL */ `
          union Payload = Foo | Bar
          type Foo {
            a: String!
          }
          type Bar {
            b: String!
          }
          type Query {
            payload: Payload
          }
        `,
        ["Payload", "Foo", "Bar"]
      );

      const fooIdx = output.indexOf("export const FooSchema");
      const barIdx = output.indexOf("export const BarSchema");
      const payloadIdx = output.indexOf("export const PayloadSchema");
      expect(fooIdx).toBeLessThan(payloadIdx);
      expect(barIdx).toBeLessThan(payloadIdx);
    });

    it("wraps cyclic union members in z.lazy", () => {
      // Tree has a self-cycle: Tree's `children` references Tree directly.
      // (Direct object self-refs aren't expected to come up often, but a real
      // cycle through a union does — Payload references PayloadA which
      // references Payload back.)
      const output = generateSchemas(
        plugin,
        context,
        /* GraphQL */ `
          union Payload = PayloadA | PayloadB
          type PayloadA {
            child: Payload
          }
          type PayloadB {
            label: String!
          }
          type Query {
            payload: Payload
          }
        `,
        ["Payload", "PayloadA", "PayloadB"]
      );

      // PayloadA → Payload → PayloadA forms an SCC, so refs within the SCC are lazy.
      // PayloadB has no inbound cycle, so it stays a plain identifier.
      expect(output).toMatch(/z\.lazy\(\(\)\s*=>\s*PayloadSchema\)/);
      expect(output).toMatch(/z\.lazy\(\(\)\s*=>\s*PayloadASchema\)/);
      expect(output).not.toMatch(/z\.lazy\(\(\)\s*=>\s*PayloadBSchema\)/);
    });
  });

  describe("output structure", () => {
    let plugin: ZodSchemaGeneratorPlugin;
    let context: TransformerContext;

    beforeAll(() => {
      context = new TransformerContext();
      plugin = new ZodSchemaGeneratorPlugin(context, { emitOutput: true });
      context.registerPlugin(plugin);
    });

    it("includes zod import statement", () => {
      const output = generateSchemas(
        plugin,
        context,
        /* GraphQL */ `
          type User {
            id: ID!
          }
          type Query {
            me: User
          }
        `,
        ["User"]
      );

      expect(output).toContain('import * as z from "zod/v4"');
    });

    it("does not generate Query type", () => {
      const output = generateSchemas(
        plugin,
        context,
        /* GraphQL */ `
          type Query {
            me: String
          }
        `,
        ["Query"]
      );

      expect(output).not.toContain("export const QuerySchema");
    });

    it("does not generate Mutation type", () => {
      const output = generateSchemas(
        plugin,
        context,
        /* GraphQL */ `
          type Mutation {
            doSomething: String
          }

          type Query {
            me: String
          }
        `,
        ["Mutation"]
      );

      expect(output).not.toContain("export const MutationSchema");
    });

    it("exports each schema as a const", () => {
      const output = generateSchemas(
        plugin,
        context,
        /* GraphQL */ `
          enum Role {
            ADMIN
          }
          type User {
            id: ID!
            role: Role
          }
          type Query {
            me: User
          }
        `,
        ["Role", "User"]
      );

      expect(output).toContain("export const RoleSchema");
      expect(output).toContain("export const UserSchema");
    });
  });

  describe("tenancy claims", () => {
    let validators: string;

    beforeAll(() => {
      const output = createTransformer({
        tenancy: { vendor: { claims: { vendorId: "ID" } } },
        plugins: [zodSchemaGeneratorPlugin({ generateArgumentSchemas: true })],
      }).transform(/* GraphQL */ `
        type Product @model @scope(name: vendor) {
          id: ID!
          name: String!
          category: Category @belongsTo
        }

        type Category @model {
          id: ID!
        }
      `);

      validators =
        output.files.find((file) => file.path === "zod/schema.validators.ts")?.content ?? "";
    });

    it("leaves a claim out of every schema", () => {
      expect(validators).toContain("export const CreateProductInputSchema");
      expect(validators).not.toContain("vendorId");
    });
  });

  describe("declared overrides", () => {
    let schema: string;

    beforeAll(() => {
      const output = createTransformer({
        semanticNullability: true,
        plugins: [zodSchemaGeneratorPlugin()],
      }).transform(/* GraphQL */ `
        type Employee @model {
          id: ID!
          name: String @semanticNonNull
          email: String
          position: String @semanticNonNull
          schedule: EmployeeSchedule @hasOne @semanticNonNull
        }

        type EmployeeSchedule @model {
          id: ID!

          startDate: Date @semanticNonNull
          endDate: Date
          employee: Employee @belongsTo @semanticNonNull
          workSchedule: WorkSchedule @belongsTo @semanticNonNull
        }

        type WorkSchedule @model {
          id: ID!

          name: String @semanticNonNull
          startTime: Time @semanticNonNull
          duration: String @semanticNonNull
          rrule: String @semanticNonNull
        }

        input CreateEmployeeInput {
          id: ID
          name: String!
          email: String
          position: String!
          schedule: CreateEmployeeScheduleInput!
        }

        input CreateEmployeeScheduleInput {
          id: ID
          startDate: Date!
          endDate: Date
          workSchedule: EmployeeScheduleWorkScheduleInput!
        }

        input EmployeeScheduleWorkScheduleInput @oneOf {
          workScheduleId: ID
          workSchedule: CreateWorkScheduleInput
        }
      `);

      schema = output.files.find((file) => file.path === "zod/schema.validators.ts")?.content ?? "";
    });

    it("folows declared overrides structure", () => {
      expect(schema).toContain("export const CreateEmployeeInputSchema");
      expect(schema).toContain("export const CreateEmployeeScheduleInputSchema");
      expect(schema).toContain("export const EmployeeScheduleWorkScheduleInputSchema");
      expect(schema).toContain("export const CreateWorkScheduleInputSchema");
    });

    it("follows the declared input for a relation field", () => {
      const createEmployee = schema.slice(
        schema.indexOf("export const CreateEmployeeInputSchema"),
        schema.indexOf("export const UpdateEmployeeInputSchema")
      );

      expect(createEmployee).toContain("schedule: CreateEmployeeScheduleInputSchema");
      expect(createEmployee).not.toContain("EmployeeScheduleSchema");
    });

    it("reads the nested declared input's fields from the input", () => {
      let createSchedule = schema.slice(
        schema.indexOf("export const CreateEmployeeScheduleInputSchema")
      );
      createSchedule = createSchedule.slice(0, createSchedule.indexOf("});"));

      expect(createSchedule).toContain("startDate: z.iso.date()");
      expect(createSchedule).toContain("workSchedule: EmployeeScheduleWorkScheduleInputSchema");
      expect(createSchedule).not.toContain("employee");
      expect(createSchedule).not.toContain("WorkScheduleSchema");
    });

    it("emits a @oneOf input as a union of single-field strict objects", () => {
      expect(schema).toContain(
        [
          "export const EmployeeScheduleWorkScheduleInputSchema = z.union([",
          "    z.strictObject({ workScheduleId: z.string() }),",
          "    z.strictObject({ workSchedule: CreateWorkScheduleInputSchema })",
          "]);",
        ].join("\n")
      );
    });

    it("declares each schema before it is used", () => {
      const order = [
        "export const CreateWorkScheduleInputSchema",
        "export const EmployeeScheduleWorkScheduleInputSchema",
        "export const CreateEmployeeScheduleInputSchema",
        "export const CreateEmployeeInputSchema",
      ].map((name) => schema.indexOf(name));

      expect(order.every((index) => index >= 0)).toBe(true);
      expect(order).toEqual([...order].sort((a, b) => a - b));
    });
  });
});
