import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resolve } from "node:path";
import picomatch, { isMatch } from "picomatch";
import { createIgnoreMatcher, DEFAULT_IGNORED_DIRS, start } from "./watcher.js";

const mockTransform = vi.fn();

describe("Watcher", () => {
  let watcher: Awaited<ReturnType<typeof start>>;

  beforeEach(async () => {
    vi.clearAllMocks();

    watcher = await start({
      paths: ["src/**/*.graphql"],
      transform: mockTransform,
    });
  });

  afterEach(() => {
    watcher.close();
  });

  it("should ignore specified directories", () => {
    const isIgnored = (path: string) => DEFAULT_IGNORED_DIRS.some((dir) => isMatch(path, dir));

    expect(isIgnored("node_modules/some-package/index.js")).toBeTruthy();
    expect(isIgnored("dist/index.js")).toBeTruthy();
    expect(isIgnored("build/index.js")).toBeTruthy();
    expect(isIgnored(".git/config")).toBeTruthy();
    expect(isIgnored("src/index.js")).toBeFalsy();
  });

  it("should get base directory from glob pattern", async () => {
    const globPatterns = ["!src/**/*.graphql", "schemas/main.graphql"];
    const expectedBaseDirs = ["src", "schemas"];

    const result = picomatch.scan(globPatterns[0]);
    expect(result.base).toBe(expectedBaseDirs[0]);
  });

  it("should call transform function on file change", async () => {
    // Simulate a file change event
    watcher.emit("all", "change", "src/schema.graphql");

    expect(mockTransform).toHaveBeenCalled();
  });

  it("does not run for files that are not GraphQL", () => {
    watcher.emit("all", "change", "src/notes.md");

    expect(mockTransform).not.toHaveBeenCalled();
  });

  it("ignores the given directories, resolved against the cwd", () => {
    const ignored = createIgnoreMatcher(["generated"]);

    expect(ignored(resolve("generated"))).toBe(true);
    expect(ignored(resolve("generated/schema.graphql"))).toBe(true);
    expect(ignored(resolve("generated-notes/schema.graphql"))).toBe(false);
    expect(ignored(resolve("src/schema.graphql"))).toBe(false);
  });
});
