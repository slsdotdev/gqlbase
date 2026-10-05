import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { run } from "./action.js";

describe("run", () => {
  let cwd: string;
  let directory: string;
  let exit: ReturnType<typeof vi.spyOn>;

  beforeAll(async () => {
    cwd = process.cwd();
    directory = await mkdtemp(join(tmpdir(), "gqlbase-cli-"));
    await writeFile(
      join(directory, "gqlbase.config.js"),
      "export default { output: 'generated' };"
    );
    process.chdir(directory);
  });

  afterAll(async () => {
    process.chdir(cwd);
    await rm(directory, { recursive: true, force: true });
  });

  beforeEach(() => {
    exit = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
  });

  it("writes the output of a valid schema", async () => {
    await writeFile(join(directory, "valid.graphql"), "type Post @model { id: ID! }");
    await run("valid.graphql", {});

    expect(exit).not.toHaveBeenCalled();
    expect(await readFile(join(directory, "generated", "schema.graphql"), "utf8")).toContain(
      "type Post"
    );
  });

  it("does not read its own output as source on the next run", async () => {
    await rm(join(directory, "invalid.graphql"), { force: true });
    await writeFile(join(directory, "valid.graphql"), "type Post @model { id: ID! }");

    // No source: the default `**/*.graphql` also matches `generated/schema.graphql`.
    await run(undefined, {});
    await run(undefined, {});

    expect(exit).not.toHaveBeenCalled();
  });

  it("exits with 1 when the transform fails", async () => {
    await writeFile(join(directory, "invalid.graphql"), "type Post @unknown { id: ID! }");
    await run("invalid.graphql", {});

    expect(exit).toHaveBeenCalledWith(1);
  });
});
