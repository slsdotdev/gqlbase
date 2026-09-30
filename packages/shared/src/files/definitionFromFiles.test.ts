import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse } from "graphql";
import { definitionFromFiles } from "./definitionFromFiles.js";

describe("definitionFromFiles", () => {
  let directory: string;
  let definition: string;

  beforeAll(async () => {
    directory = await mkdtemp(join(tmpdir(), "gqlbase-files-"));
    // The first file ends in a name token, with no trailing newline.
    await writeFile(join(directory, "a.graphql"), "scalar Money");
    await writeFile(join(directory, "b.graphql"), "type Query {\n  price: Money\n}\n");

    definition = definitionFromFiles(directory);
  });

  afterAll(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it("separates files so their tokens do not fuse", () => {
    const names = parse(definition).definitions.map((node) =>
      "name" in node ? node.name?.value : undefined
    );

    expect(names).toEqual(["Money", "Query"]);
  });
});
