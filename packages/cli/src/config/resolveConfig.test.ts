import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ConfigurationError } from "@gqlbase/shared/errors";
import { resolveConfig } from "./resolveConfig.js";

describe("resolveConfig", () => {
  let cwd: string;
  let directory: string;

  beforeAll(async () => {
    cwd = process.cwd();
    directory = await mkdtemp(join(tmpdir(), "gqlbase-config-"));
    process.chdir(directory);
  });

  afterAll(async () => {
    process.chdir(cwd);
    await rm(directory, { recursive: true, force: true });
  });

  afterEach(async () => {
    await rm(join(directory, "gqlbase.config.js"), { force: true });
  });

  it("merges the config file over the defaults, and the CLI options over both", async () => {
    await writeFile(
      join(directory, "gqlbase.config.js"),
      "export default { source: 'schema', output: 'out' };"
    );

    const config = await resolveConfig({ source: undefined, output: "cli-out" });

    expect(config.source).toBe("schema");
    expect(config.output).toBe("cli-out");
    expect(config.watch).toBe(false);
  });

  it("throws when no config file is found", async () => {
    await expect(resolveConfig()).rejects.toThrow(/No configuration file found/);
  });

  it("names the missing file given with --config", async () => {
    await expect(resolveConfig({ source: undefined, config: "missing.js" })).rejects.toThrow(
      `Configuration file not found: ${join(process.cwd(), "missing.js")}`
    );
  });

  it("reports a config file that fails to import, with the cause", async () => {
    // A file name of its own: ESM caches every imported URL.
    await writeFile(join(directory, "broken.config.js"), "export default {");

    const error = await resolveConfig({ source: undefined, config: "broken.config.js" }).catch(
      (error: unknown) => error
    );

    expect(error).toBeInstanceOf(ConfigurationError);
    expect((error as Error).message).toMatch(/Failed to load configuration file/);
    expect((error as Error).cause).toBeInstanceOf(Error);
  });

  it("throws when the config file has no default export", async () => {
    await writeFile(join(directory, "named.config.js"), "export const config = {};");

    await expect(resolveConfig({ source: undefined, config: "named.config.js" })).rejects.toThrow(
      /has no default export/
    );
  });
});
