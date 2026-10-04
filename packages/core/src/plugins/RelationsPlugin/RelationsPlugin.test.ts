import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { print } from "graphql";
import { TransformerContext } from "../../context/index.js";
import { DocumentNode, InterfaceNode, ListTypeNode, ObjectNode } from "../../definition/index.js";
import { RelationsPlugin } from "./RelationsPlugin.js";
import { createTransformer } from "../../transformer/index.js";

const document = DocumentNode.fromSource(/* GraphQL */ `
  type User @model {
    id: ID!
    name: String!
    posts: Post @hasMany(key: "authorId")
  }

  type Post @model {
    id: ID!
    title: String!
    author: User @hasOne
    tags: Tag @hasMany
  }

  type Tag @model {
    id: ID!
    name: String!
  }

  type Viewer {
    user: User @belongsTo @clientOnly
  }
`);

describe("RelationsPlugin", () => {
  let context: TransformerContext;
  let plugin: RelationsPlugin;

  beforeAll(() => {
    context = new TransformerContext({});
    plugin = new RelationsPlugin(context);
    context.registerPlugin(plugin);
  });

  beforeEach(() => {
    context.finishWork();
    context.startWork(document);
  });

  it("adds relation directive definitions", () => {
    expect(context.document.getNode("hasOne")).toBeDefined();
    expect(context.document.getNode("hasMany")).toBeDefined();
  });

  it("adds keys to relation fields", () => {
    const userNode = context.document.getNodeOrThrow("User") as ObjectNode;
    const postNode = context.document.getNodeOrThrow("Post") as ObjectNode;

    plugin.normalize(userNode);

    expect(postNode.hasField("authorId")).toBeTruthy();
    expect(postNode.getField("authorId")?.type.getTypeName()).toBe("ID");
  });

  it("adds list type to hasMany fields", () => {
    const userNode = context.document.getNodeOrThrow("User") as ObjectNode;
    const postNode = context.document.getNodeOrThrow("Post") as ObjectNode;

    plugin.execute(userNode);
    plugin.execute(postNode);

    expect(userNode.getField("posts")?.type).toBeInstanceOf(ListTypeNode);
    expect(postNode.getField("tags")?.type).toBeInstanceOf(ListTypeNode);
  });

  it("does not modify client-only fields", () => {
    const viewerNode = context.document.getNodeOrThrow("Viewer") as ObjectNode;

    plugin.normalize(viewerNode);
    plugin.execute(viewerNode);

    expect(viewerNode.getField("user")?.type.getTypeName()).toBe("User");
    expect(viewerNode.hasField("userId")).toBeFalsy();
  });
});

describe("RelationsPlugin keys between stored types", () => {
  const source = /* GraphQL */ `
    type Employee @model {
      id: ID!
      team: Team @belongsTo
      badge: Badge @hasOne
      settings: Settings @hasOne
      owner: Owner @belongsTo
    }

    type Team @model {
      id: ID!
      members: Employee @hasMany
      assets: Asset @hasMany
      devices: Device @hasMany
    }

    type Badge @model {
      id: ID!
    }

    type Settings {
      id: ID!
    }

    type Owner @model @clientOnly {
      id: ID!
      employees: Employee @hasMany
    }

    type Viewer {
      employees: Employee @hasMany(key: "viewerId")
    }

    type Session {
      id: ID!
      employees: Employee @hasMany
    }

    interface Asset {
      id: ID!
    }

    type Laptop implements Asset @model {
      id: ID!
    }

    interface Device {
      id: ID!
    }

    type Phone implements Device {
      id: ID!
    }

    type Query {
      employees: Employee @hasMany(key: "queryId")
    }
  `;

  let context: TransformerContext;
  let employee: ObjectNode;
  let badge: ObjectNode;
  let asset: InterfaceNode;
  let laptop: ObjectNode;

  beforeAll(() => {
    context = new TransformerContext({});
    const plugin = new RelationsPlugin(context);
    context.registerPlugin(plugin);
    context.startWork(DocumentNode.fromSource(source));

    for (const name of ["Employee", "Team", "Owner", "Viewer", "Session", "Query"]) {
      plugin.normalize(context.document.getNodeOrThrow(name) as ObjectNode);
    }

    employee = context.document.getNodeOrThrow("Employee") as ObjectNode;
    badge = context.document.getNodeOrThrow("Badge") as ObjectNode;
    asset = context.document.getNodeOrThrow("Asset") as InterfaceNode;
    laptop = context.document.getNodeOrThrow("Laptop") as ObjectNode;
  });

  it("keys @model to @model", () => {
    expect(employee.hasField("teamId")).toBe(true);
    expect(badge.hasField("employeeId")).toBe(true);
  });

  it("keys a @model to an interface every implementation of which is a @model, on each implementation", () => {
    expect(laptop.hasField("teamId")).toBe(true);
    expect(asset.hasField("teamId")).toBe(false);
  });

  it("does not key a @model to an interface with a plain implementation", () => {
    const device = context.document.getNodeOrThrow("Device") as InterfaceNode;
    expect(device.hasField("teamId")).toBe(false);
  });

  it("does not key from a root type", () => {
    expect(employee.hasField("queryId")).toBe(false);
  });

  it("does not key from a plain type without an id, instead of throwing", () => {
    expect(employee.hasField("viewerId")).toBe(false);
  });

  it("does not key from a plain type with an id", () => {
    expect(employee.hasField("sessionId")).toBe(false);
  });

  it("does not key from a @clientOnly type", () => {
    expect(employee.hasField("ownerId")).toBe(false);
  });

  it("does not key a @model to a plain type", () => {
    const settings = context.document.getNodeOrThrow("Settings") as ObjectNode;
    expect(settings.hasField("employeeId")).toBe(false);
  });
});

describe("RelationsPlugin key without an id", () => {
  let context: TransformerContext;
  let plugin: RelationsPlugin;

  beforeAll(() => {
    context = new TransformerContext({});
    plugin = new RelationsPlugin(context);
    context.registerPlugin(plugin);
    context.startWork(
      DocumentNode.fromSource(/* GraphQL */ `
        type Log @model {
          entries: Entry @hasMany
        }

        type Entry @model {
          id: ID!
        }
      `)
    );
  });

  it("names the source that has no id", () => {
    const log = context.document.getNodeOrThrow("Log") as ObjectNode;

    expect(() => plugin.normalize(log)).toThrow(
      "Relation Log.entries needs the id of Log for its key, but Log has no id field."
    );
  });
});

describe("RelationsPlugin list shape", () => {
  const source = /* GraphQL */ `
    type User {
      id: ID!
      posts: Post @hasMany
      drafts: Post! @hasMany
      pinned: [Post] @hasMany
      archived: Post @hasMany @semanticNonNull
    }

    type Post {
      id: ID!
    }
  `;

  describe("with relay off", () => {
    let context: TransformerContext;
    let user: ObjectNode;

    beforeAll(() => {
      context = new TransformerContext({ semanticNullability: true });
      const plugin = new RelationsPlugin(context);
      context.registerPlugin(plugin);
      context.startWork(DocumentNode.fromSource(source));
      user = context.document.getNodeOrThrow("User") as ObjectNode;
      plugin.execute(user);
    });

    it("turns a nullable @hasMany into a nullable list of non-null items", () => {
      const posts = user.getField("posts")?.type;
      expect(posts && print(posts.serialize())).toBe("[Post!]");
    });

    it("turns a non-null @hasMany into a non-null list of non-null items", () => {
      const drafts = user.getField("drafts")?.type;
      expect(drafts && print(drafts.serialize())).toBe("[Post!]!");
    });

    it("keeps @semanticNonNull on the field", () => {
      const field = user.getField("archived");

      expect(field && print(field.type.serialize())).toBe("[Post!]");
      expect(field?.hasDirective("semanticNonNull")).toBe(true);
    });

    it("leaves a type already written as a list as written", () => {
      const pinned = user.getField("pinned")?.type;
      expect(pinned && print(pinned.serialize())).toBe("[Post]");
    });

    it("adds no pagination arguments", () => {
      expect(user.getField("posts")?.arguments ?? []).toEqual([]);
    });
  });

  describe("with relay on", () => {
    let context: TransformerContext;
    let user: ObjectNode;

    beforeAll(() => {
      context = new TransformerContext({ relay: true });
      const plugin = new RelationsPlugin(context);
      context.registerPlugin(plugin);
      context.startWork(DocumentNode.fromSource(source.replace("@semanticNonNull", "")));
      user = context.document.getNodeOrThrow("User") as ObjectNode;
      plugin.execute(user);
    });

    it("leaves @hasMany fields for ConnectionPlugin", () => {
      const posts = user.getField("posts")?.type;
      expect(posts && print(posts.serialize())).toBe("Post");
      const drafts = user.getField("drafts")?.type;
      expect(drafts && print(drafts.serialize())).toBe("Post!");
    });
  });
});

describe("RelationsPlugin declared key on a relation without one", () => {
  it("accepts a key the target declares", () => {
    expect(() =>
      createTransformer().transform(/* GraphQL */ `
        type Order @model {
          id: ID!
          userId: ID!
        }

        type Viewer {
          orders: Order @hasMany(key: "userId")
        }

        type Query {
          viewer: Viewer!
        }
      `)
    ).not.toThrow();
  });

  it("accepts a key that another relation adds", () => {
    expect(() =>
      createTransformer().transform(/* GraphQL */ `
        type Viewer {
          orders: Order @hasMany(key: "userId")
        }

        type Order @model {
          id: ID!
        }

        type User @model {
          id: ID!
          orders: Order @hasMany
        }

        type Query {
          viewer: Viewer!
        }
      `)
    ).not.toThrow();
  });

  it("throws when the target of a @hasMany has no such field", () => {
    expect(() =>
      createTransformer().transform(/* GraphQL */ `
        type Order @model {
          id: ID!
        }

        type Viewer {
          orders: Order @hasMany(key: "userId")
        }

        type Query {
          viewer: Viewer!
        }
      `)
    ).toThrow(/Viewer.orders declares key "userId", but Order has no field userId/);
  });

  it("throws when the parent of a @belongsTo has no such field", () => {
    expect(() =>
      createTransformer().transform(/* GraphQL */ `
        type Invoice @model {
          id: ID!
        }

        type Settlement {
          invoice: Invoice @belongsTo(key: "invoiceId")
        }

        type Query {
          settlement: Settlement
        }
      `)
    ).toThrow(/Settlement.invoice declares key "invoiceId", but Settlement has no field invoiceId/);
  });

  it("checks a @clientOnly relation field too", () => {
    expect(() =>
      createTransformer().transform(/* GraphQL */ `
        type Order @model {
          id: ID!
        }

        type User @model {
          id: ID!
          recent: Order @hasMany(key: "buyerId") @clientOnly
        }
      `)
    ).toThrow(/User.recent declares key "buyerId", but Order has no field buyerId/);
  });
});

describe("RelationsPlugin GUID keys", () => {
  let context: TransformerContext;
  let plugin: RelationsPlugin;

  beforeAll(() => {
    context = new TransformerContext({});
    plugin = new RelationsPlugin(context);
    context.registerPlugin(plugin);
  });

  beforeEach(() => {
    context.finishWork();
    context.startWork(
      DocumentNode.fromSource(/* GraphQL */ `
        type Vendor @model {
          id: GUID!
          products: Product @hasMany
        }

        type Product @model {
          id: GUID!
          category: Category @belongsTo
        }

        type Category @model {
          id: ID!
        }
      `)
    );
  });

  it("types a key with the target's id type", () => {
    const vendor = context.document.getNodeOrThrow("Vendor") as ObjectNode;
    const product = context.document.getNodeOrThrow("Product") as ObjectNode;

    plugin.normalize(vendor);
    plugin.normalize(product);

    expect(product.getField("vendorId")?.type.getTypeName()).toBe("GUID");
    expect(product.getField("categoryId")?.type.getTypeName()).toBe("ID");
  });

  it("throws on a declared key that does not hold the target's GUID ids", () => {
    expect(() =>
      createTransformer().transform(/* GraphQL */ `
        type Vendor @model {
          id: GUID!
        }

        type Product @model {
          id: GUID!
          vendorId: ID!
          vendor: Vendor @belongsTo
        }
      `)
    ).toThrow(/Product.vendorId is a relation key of type ID, but the ids it holds are GUID/);
  });

  it("throws on a declared GUID key to a target without GUID ids", () => {
    expect(() =>
      createTransformer().transform(/* GraphQL */ `
        type Vendor @model {
          id: ID!
        }

        type Product @model {
          id: ID!
          vendorId: GUID!
          vendor: Vendor @belongsTo
        }
      `)
    ).toThrow(/Product.vendorId is a relation key of type GUID, but the ids it holds are ID/);
  });

  it("accepts ID and UUID keys for each other", () => {
    expect(() =>
      createTransformer().transform(/* GraphQL */ `
        type Vendor @model {
          id: UUID!
        }

        type Product @model {
          id: ID!
          vendorId: ID!
          vendor: Vendor @belongsTo
        }
      `)
    ).not.toThrow();
  });

  it("accepts a tenancy claim as the key, whatever its type", () => {
    expect(() =>
      createTransformer({
        tenancy: { vendor: { default: true, claims: { vendorId: "UUID" } } },
      }).transform(/* GraphQL */ `
        type Vendor @model @scope(name: vendor) {
          id: GUID!
        }

        type Product @model {
          id: GUID!
          vendor: Vendor @belongsTo
        }
      `)
    ).not.toThrow();
  });
});

describe("RelationsPlugin polymorphic targets", () => {
  let context: TransformerContext;
  let plugin: RelationsPlugin;

  beforeAll(() => {
    context = new TransformerContext({});
    plugin = new RelationsPlugin(context);
    context.registerPlugin(plugin);
  });

  beforeEach(() => {
    context.finishWork();
    context.startWork(
      DocumentNode.fromSource(/* GraphQL */ `
        union Owner = Invoice | PaymentOrder

        interface Document {
          title: String!
        }

        type Invoice implements Document @model {
          id: GUID!
          title: String!
        }

        type PaymentOrder implements Document @model {
          id: GUID!
          title: String!
        }

        type Resource @model {
          id: GUID!
          owner: Owner @belongsTo
          document: Document! @belongsTo(key: "docId", discriminator: "docKind")
        }

        type Folder @model {
          id: ID!
          items: Owner @hasMany
          documents: Document @hasMany
        }
      `)
    );
  });

  it("adds a discriminator beside the key of a @belongsTo to a union", () => {
    const resource = context.document.getNodeOrThrow("Resource") as ObjectNode;

    plugin.normalize(resource);

    const ownerIdType = resource.getField("ownerId")?.type;
    expect(ownerIdType && print(ownerIdType.serialize())).toBe("GUID");
    const ownerTypeField = resource.getField("ownerType")?.type;
    expect(ownerTypeField && print(ownerTypeField.serialize())).toBe("String");
    expect(resource.getField("ownerType")?.directives?.map((d) => d.name)).toEqual([
      "serverOnly",
      "writeOnly",
    ]);
  });

  it("names the key and discriminator of a @belongsTo to an interface from its arguments", () => {
    const resource = context.document.getNodeOrThrow("Resource") as ObjectNode;

    plugin.normalize(resource);

    const docIdType = resource.getField("docId")?.type;
    expect(docIdType && print(docIdType.serialize())).toBe("GUID!");
    const docKindType = resource.getField("docKind")?.type;
    expect(docKindType && print(docKindType.serialize())).toBe("String!");
  });

  it("puts a @hasMany key on every member, with the relation's nullability", () => {
    const folder = context.document.getNodeOrThrow("Folder") as ObjectNode;

    plugin.normalize(folder);

    for (const name of ["Invoice", "PaymentOrder"]) {
      const member = context.document.getNodeOrThrow(name) as ObjectNode;
      const folderIdType = member.getField("folderId")?.type;
      expect(folderIdType && print(folderIdType.serialize())).toBe("ID");
    }

    expect(
      (context.document.getNodeOrThrow("Document") as InterfaceNode).hasField("folderId")
    ).toBe(false);
  });

  it("throws on members that mix GUID ids with others", () => {
    expect(() =>
      createTransformer().transform(/* GraphQL */ `
        union Owner = Invoice | Vendor

        type Invoice @model {
          id: GUID!
        }

        type Vendor @model {
          id: ID!
        }

        type Resource @model {
          id: ID!
          owner: Owner @belongsTo
        }
      `)
    ).toThrow(/Owner, whose members mix GUID ids with ID/);
  });
});
