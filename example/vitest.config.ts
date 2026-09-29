import { defineConfig } from "vitest/config";

export default defineConfig({
  cacheDir: "../node_modules/.vitest",
  test: {
    name: "example",
    environment: "node",
    globals: true,
    include: ["test/**/*.test.ts"],
    // Each test file runs in its own module graph, so it gets its own in-memory database.
    isolate: true,
  },
});
