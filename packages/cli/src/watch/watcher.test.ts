import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import picomatch, { isMatch } from "picomatch";
import { DEFAULT_IGNORED_DIRS, start } from "./watcher.js";

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
});
