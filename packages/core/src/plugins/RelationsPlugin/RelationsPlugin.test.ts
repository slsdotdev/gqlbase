import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { print } from "graphql";
import { TransformerContext } from "../../context/index.js";
import { DocumentNode, InterfaceNode, ListTypeNode, ObjectNode } from "../../definition/index.js";
import { RelationsPlugin } from "./RelationsPlugin.js";

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
  });

  it("keys @model to @model", () => {
    expect(employee.hasField("teamId")).toBe(true);
    expect(badge.hasField("employeeId")).toBe(true);
  });

  it("keys a @model to an interface every implementation of which is a @model", () => {
    expect(asset.hasField("teamId")).toBe(true);
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
